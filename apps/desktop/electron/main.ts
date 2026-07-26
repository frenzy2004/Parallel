import {
  app,
  BrowserWindow,
  desktopCapturer,
  globalShortcut,
  ipcMain,
  screen,
  systemPreferences,
} from "electron";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { createTwinEngineFromEnv } from "@parallel/twin-engine";
import type {
  StaticsPatternId,
  StructuralSignature,
  TwinRender,
} from "@parallel/contracts";
import { TelemetryStore, type OutcomeEvent } from "./telemetry.js";
import {
  PrecedentStore,
  recordPrecedentOutcome,
} from "./precedents.js";
import {
  chooseSidecarBounds,
  projectNormalizedHighlights,
  type MappingHighlight,
  type Rectangle,
} from "./window-placement.js";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const rendererUrl = process.env.PARALLEL_RENDERER_URL;
const preloadPath = join(currentDirectory, "preload.cjs");
const rendererFile = join(currentDirectory, "../dist/index.html");

let captureWindow: BrowserWindow | null = null;
let sidecarWindow: BrowserWindow | null = null;
let mappingWindow: BrowserWindow | null = null;
let activeDisplayBounds: Rectangle | null = null;
let activeLassoBounds: Rectangle | null = null;
let telemetry: TelemetryStore | null = null;
let precedents: PrecedentStore | null = null;
let activeSessionId = randomUUID();
let activePatternId: StaticsPatternId | null = null;
let invocationStartedAt = 0;
let recognitionMs: number | null = null;
let fullMappingMs: number | null = null;
let activeSignature: StructuralSignature | null = null;
let activeTwin: TwinRender | null = null;

const loadView = async (window: BrowserWindow, view: string): Promise<void> => {
  if (rendererUrl) {
    await window.loadURL(`${rendererUrl}?view=${view}`);
  } else {
    await window.loadFile(rendererFile, { query: { view } });
  }
};

const secureWindowOptions = {
  webPreferences: {
    preload: preloadPath,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
  },
} as const;

const dismiss = (): void => {
  captureWindow?.close();
  sidecarWindow?.close();
  mappingWindow?.close();
  captureWindow = null;
  sidecarWindow = null;
  mappingWindow = null;
  activeDisplayBounds = null;
  activeLassoBounds = null;
};

const openCapture = async (): Promise<void> => {
  dismiss();
  activeSessionId = randomUUID();
  activePatternId = null;
  invocationStartedAt = performance.now();
  recognitionMs = null;
  fullMappingMs = null;
  activeSignature = null;
  activeTwin = null;
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  activeDisplayBounds = display.bounds;
  const access = systemPreferences.getMediaAccessStatus("screen");
  if (access === "denied" || access === "restricted") {
    throw new Error(
      "Screen recording access is required in System Settings → Privacy & Security.",
    );
  }

  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: {
      width: Math.round(display.size.width * display.scaleFactor),
      height: Math.round(display.size.height * display.scaleFactor),
    },
  });
  const source =
    sources.find((candidate) => candidate.display_id === String(display.id)) ??
    sources[0];
  if (!source) {
    throw new Error("No display capture source is available");
  }

  captureWindow = new BrowserWindow({
    ...display.bounds,
    ...secureWindowOptions,
    show: false,
    transparent: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
  });
  captureWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  await loadView(captureWindow, "capture");
  captureWindow.webContents.send(
    "parallel:capture-source",
    source.thumbnail.toDataURL(),
  );
  captureWindow.show();
  captureWindow.focus();
};

const showSidecar = async (
  cropDataUrl: string,
  lassoBounds: Rectangle,
): Promise<void> => {
  if (!activeDisplayBounds) {
    throw new Error("Capture display bounds are unavailable");
  }
  activeLassoBounds = lassoBounds;
  captureWindow?.close();
  captureWindow = null;

  const bounds = chooseSidecarBounds(lassoBounds, activeDisplayBounds, {
    width: 380,
    height: 520,
  });
  sidecarWindow = new BrowserWindow({
    x: Math.round(bounds.x),
    y: Math.round(bounds.y),
    width: bounds.width,
    height: bounds.height,
    ...secureWindowOptions,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: "#10131a",
  });
  await loadView(sidecarWindow, "sidecar");

  const engine = createTwinEngineFromEnv(process.env);
  for await (const event of engine.stream({
    cropDataUrl,
    coursePackId: "statics-2d-v1",
  })) {
    if (sidecarWindow?.isDestroyed() !== false) {
      break;
    }
    if (event.state === "recognized") {
      activePatternId = event.signature.patternId;
      activeSignature = event.signature;
      recognitionMs = Math.round(performance.now() - invocationStartedAt);
    }
    if (event.state === "complete") {
      activeTwin = event.twin;
      fullMappingMs = Math.round(performance.now() - invocationStartedAt);
    }
    sidecarWindow.webContents.send("parallel:twin-event", event);
  }
};

const showMapping = async (highlights: MappingHighlight[]): Promise<void> => {
  if (!activeDisplayBounds || !activeLassoBounds || highlights.length === 0) {
    mappingWindow?.close();
    mappingWindow = null;
    return;
  }
  if (!mappingWindow) {
    mappingWindow = new BrowserWindow({
      ...activeDisplayBounds,
      ...secureWindowOptions,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      focusable: false,
      skipTaskbar: true,
    });
    mappingWindow.setIgnoreMouseEvents(true);
    await loadView(mappingWindow, "mapping");
  }
  mappingWindow.webContents.send(
    "parallel:mapping-rects",
    projectNormalizedHighlights(
      highlights,
      activeLassoBounds,
      activeDisplayBounds,
    ),
  );
};

app.whenReady().then(() => {
  const databasePath = join(app.getPath("userData"), "parallel.sqlite");
  const nativeBinding = join(
    app.getAppPath(),
    "native",
    "better_sqlite3.node",
  );
  telemetry = new TelemetryStore(databasePath, nativeBinding);
  precedents = new PrecedentStore(databasePath, nativeBinding);
  const registered = globalShortcut.register("Alt+Space", () => {
    void openCapture();
  });
  if (!registered) {
    throw new Error("Could not register Option+Space");
  }
});

ipcMain.handle("parallel:start-capture", openCapture);
ipcMain.handle(
  "parallel:submit-crop",
  async (
    _event,
    payload: { cropDataUrl: string; bounds: Rectangle },
  ): Promise<void> => showSidecar(payload.cropDataUrl, payload.bounds),
);
ipcMain.handle(
  "parallel:set-mapping-highlights",
  async (_event, highlights: MappingHighlight[]): Promise<void> =>
    showMapping(highlights),
);
ipcMain.handle("parallel:dismiss", () => dismiss());
ipcMain.handle(
  "parallel:record-outcome",
  (_event, outcome: OutcomeEvent): void => {
    if (!["unlocked", "wrong_twin", "another_twin"].includes(outcome)) {
      throw new Error("Unsupported outcome");
    }
    telemetry?.record({
      sessionId: activeSessionId,
      outcome,
      patternId: activePatternId,
      recognitionMs,
      fullMappingMs,
    });
    if (
      precedents &&
      activeSignature &&
      activeTwin &&
      ["unlocked", "wrong_twin", "another_twin"].includes(outcome)
    ) {
      recordPrecedentOutcome(
        precedents,
        activeSignature,
        activeTwin,
        outcome as "unlocked" | "wrong_twin" | "another_twin",
      );
    }
  },
);
ipcMain.handle(
  "parallel:match-precedent",
  (_event, signature: StructuralSignature) =>
    precedents?.matchPrecedent(signature) ?? null,
);

app.on("will-quit", () => {
  telemetry?.close();
  telemetry = null;
  precedents?.close();
  precedents = null;
  globalShortcut.unregisterAll();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
