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
import { createTwinEngineFromEnv } from "@parallel/twin-engine";
import { chooseSidecarBounds, type Rectangle } from "./window-placement.js";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const rendererUrl = process.env.PARALLEL_RENDERER_URL;
const preloadPath = join(currentDirectory, "preload.js");
const rendererFile = join(currentDirectory, "../dist/index.html");

let captureWindow: BrowserWindow | null = null;
let sidecarWindow: BrowserWindow | null = null;
let mappingWindow: BrowserWindow | null = null;
let activeDisplayBounds: Rectangle | null = null;
let activeLassoBounds: Rectangle | null = null;

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
    sidecarWindow.webContents.send("parallel:twin-event", event);
  }
};

const showMapping = async (anchorIds: string[]): Promise<void> => {
  if (!activeDisplayBounds || !activeLassoBounds || anchorIds.length === 0) {
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
  const localRect = {
    x: activeLassoBounds.x - activeDisplayBounds.x,
    y: activeLassoBounds.y - activeDisplayBounds.y,
    width: activeLassoBounds.width,
    height: activeLassoBounds.height,
    label: anchorIds.join(", "),
  };
  mappingWindow.webContents.send("parallel:mapping-rects", [localRect]);
};

app.whenReady().then(() => {
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
  async (_event, anchorIds: string[]): Promise<void> => showMapping(anchorIds),
);
ipcMain.handle("parallel:dismiss", () => dismiss());

app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
