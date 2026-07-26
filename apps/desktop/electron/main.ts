import {
  app,
  BrowserWindow,
  desktopCapturer,
  dialog,
  globalShortcut,
  ipcMain,
  screen,
  shell,
  systemPreferences,
  type IpcMainInvokeEvent,
} from "electron";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createTwinEngineFromEnv } from "@parallel/twin-engine";
import type {
  StaticsPatternId,
  StructuralSignature,
  TwinRender,
} from "@parallel/contracts";
import type { TwinEvent } from "@parallel/contracts/events";
import {
  captureModeForScreenAccess,
  GenerationSession,
  dismissOverlayState,
  runGuarded,
  type GenerationLease,
  type RecoveryNotice,
} from "./generation-session.js";
import {
  PrecedentStore,
  recordPrecedentFeedback,
  recordPrecedentOutcome,
} from "./precedents.js";
import {
  assertTrustedIpcSender,
  isTrustedRendererDocumentUrl,
  resolveRendererSource,
  validateAnchorIds,
  validateCropPayload,
  validateNoPayload,
  validateOutcome,
  validateSinglePayload,
  type RendererOutcome,
  type RendererSource,
  type RendererView,
} from "./runtime-guard.js";
import { TelemetryStore } from "./telemetry.js";
import {
  chooseSidecarBounds,
  keepOverlayVisibleAcrossSpaces,
  projectNormalizedHighlights,
  type MappingHighlight,
  type Rectangle,
} from "./window-placement.js";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const preloadPath = join(currentDirectory, "preload.cjs");
const rendererFile = join(currentDirectory, "../dist/index.html");
const screenRecordingSettingsUrl =
  "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture";

let rendererSource: RendererSource = resolveRendererSource(
  undefined,
  rendererFile,
);
let captureWindow: BrowserWindow | null = null;
let activeCaptureView: "capture" | "import" | null = null;
let importReferenceLocked = false;
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
let activeIterator: AsyncGenerator<TwinEvent> | null = null;
let activeVariation = 0;
let overlayEpoch = 0;

const generation = new GenerationSession();

const secureWindowOptions = {
  webPreferences: {
    preload: preloadPath,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    webviewTag: false,
    spellcheck: false,
  },
} as const;

const configureWindowTrust = (window: BrowserWindow): void => {
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  const rejectUntrustedNavigation = (
    event: Electron.Event,
    url: string,
  ): void => {
    if (!isTrustedRendererDocumentUrl(url, rendererSource)) {
      event.preventDefault();
    }
  };
  window.webContents.on("will-navigate", rejectUntrustedNavigation);
  window.webContents.on("will-redirect", rejectUntrustedNavigation);
};

const loadView = async (
  window: BrowserWindow,
  view: RendererView,
): Promise<void> => {
  configureWindowTrust(window);
  if (rendererSource.kind === "development") {
    const target = new URL(rendererSource.origin);
    target.searchParams.set("view", view);
    await window.loadURL(target.toString());
    return;
  }
  await window.loadFile(rendererSource.rendererFile, { query: { view } });
};

const showRecoveryNotice = async (
  notice: RecoveryNotice,
): Promise<void> => {
  const buttons = notice.canOpenSettings
    ? ["Open System Settings", "Not now"]
    : ["OK"];
  const result = await dialog.showMessageBox({
    type: "warning",
    title: `PARALLEL · ${notice.title}`,
    message: notice.title,
    detail: notice.detail,
    buttons,
    defaultId: 0,
    cancelId: buttons.length - 1,
    noLink: true,
  });
  if (notice.canOpenSettings && result.response === 0) {
    await shell.openExternal(screenRecordingSettingsUrl);
  }
};

const showUnexpectedFailure = async (error: Error): Promise<void> => {
  await showRecoveryNotice({
    title: "PARALLEL could not open",
    detail: `${error.message}\n\nDismiss this message and try Option+Space again.`,
    canOpenSettings: false,
  });
};

const cancelActiveIterator = (): void => {
  const iterator = activeIterator;
  activeIterator = null;
  if (iterator) {
    void iterator.return(undefined).catch(() => undefined);
  }
};

const clearActiveTwin = (): void => {
  activePatternId = null;
  activeSignature = null;
  activeTwin = null;
  recognitionMs = null;
  fullMappingMs = null;
};

const dismiss = (): void => {
  overlayEpoch += 1;
  cancelActiveIterator();
  dismissOverlayState(generation, [
    captureWindow,
    sidecarWindow,
    mappingWindow,
  ]);
  captureWindow = null;
  activeCaptureView = null;
  importReferenceLocked = false;
  sidecarWindow = null;
  mappingWindow = null;
  activeDisplayBounds = null;
  activeLassoBounds = null;
  activeVariation = 0;
  clearActiveTwin();
};

const assertWindowSender = (
  event: IpcMainInvokeEvent,
  expectedWindow: BrowserWindow | null,
  expectedView?: RendererView,
): void => {
  if (!expectedWindow || expectedWindow.isDestroyed()) {
    throw new Error("Rejected IPC sender without an active overlay window");
  }
  assertTrustedIpcSender(
    {
      senderId: event.sender.id,
      senderUrl: event.senderFrame?.url ?? "",
    },
    expectedWindow.webContents.id,
    rendererSource,
    expectedView,
  );
};

const assertActiveOverlaySender = (event: IpcMainInvokeEvent): void => {
  const expected = [captureWindow, sidecarWindow].find(
    (window) =>
      window &&
      !window.isDestroyed() &&
      window.webContents.id === event.sender.id,
  );
  assertWindowSender(
    event,
    expected ?? null,
    expected === captureWindow
      ? (activeCaptureView ?? undefined)
      : expected === sidecarWindow
        ? "sidecar"
        : undefined,
  );
};

const resetAttemptState = (variation = 0): void => {
  activeSessionId = randomUUID();
  invocationStartedAt = performance.now();
  activeVariation = variation;
  clearActiveTwin();
};

const showImport = async (
  display: Electron.Display,
  requestEpoch: number,
): Promise<void> => {
  importReferenceLocked = false;
  const width = Math.min(460, display.workArea.width);
  const height = Math.min(620, display.workArea.height);
  const target = new BrowserWindow({
    x: display.workArea.x + Math.round((display.workArea.width - width) / 2),
    y: display.workArea.y + Math.round((display.workArea.height - height) / 2),
    width,
    height,
    ...secureWindowOptions,
    show: false,
    frame: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: "#10131a",
    title: "PARALLEL · Import a screenshot",
  });
  captureWindow = target;
  activeCaptureView = "import";
  keepOverlayVisibleAcrossSpaces(target);
  target.once("closed", () => {
    if (captureWindow === target) {
      captureWindow = null;
      activeCaptureView = null;
    }
  });
  await loadView(target, "import");
  if (
    requestEpoch !== overlayEpoch ||
    target.isDestroyed() ||
    captureWindow !== target
  ) {
    if (!target.isDestroyed()) target.close();
    return;
  }
  target.show();
  target.focus();
};

const openCapture = async (): Promise<void> => {
  dismiss();
  const requestEpoch = overlayEpoch;
  resetAttemptState();

  const access = systemPreferences.getMediaAccessStatus("screen");
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  activeDisplayBounds = display.bounds;
  if (captureModeForScreenAccess(access) === "import") {
    await showImport(display, requestEpoch);
    return;
  }

  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: {
      width: Math.round(display.size.width * display.scaleFactor),
      height: Math.round(display.size.height * display.scaleFactor),
    },
  });
  if (requestEpoch !== overlayEpoch) return;

  const source =
    sources.find((candidate) => candidate.display_id === String(display.id)) ??
    sources[0];
  if (!source) {
    throw new Error("No display capture source is available.");
  }

  const target = new BrowserWindow({
    ...display.bounds,
    ...secureWindowOptions,
    show: false,
    transparent: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
  });
  captureWindow = target;
  activeCaptureView = "capture";
  keepOverlayVisibleAcrossSpaces(target);
  await loadView(target, "capture");
  if (
    requestEpoch !== overlayEpoch ||
    target.isDestroyed() ||
    captureWindow !== target
  ) {
    if (!target.isDestroyed()) target.close();
    return;
  }
  target.webContents.send(
    "parallel:capture-source",
    source.thumbnail.toDataURL(),
  );
  target.show();
  target.focus();
};

const canDeliverToSidecar = (
  lease: GenerationLease,
  target: BrowserWindow,
): boolean =>
  generation.canDeliver(lease) &&
  sidecarWindow === target &&
  !target.isDestroyed();

const runTwinGeneration = async (
  cropDataUrl: string,
  target: BrowserWindow,
): Promise<void> => {
  cancelActiveIterator();
  const lease = generation.begin(cropDataUrl);
  const iterator = createTwinEngineFromEnv(process.env).stream(
    {
      cropDataUrl,
      coursePackId: "statics-2d-v1",
    },
    { signal: lease.signal, variation: activeVariation },
  );
  await deliverTwinEvents(iterator, lease, target);
};

const runTwinRegeneration = async (
  signature: StructuralSignature,
  twin: TwinRender,
  variation: number,
  target: BrowserWindow,
): Promise<void> => {
  cancelActiveIterator();
  const lease = generation.begin();
  const iterator = createTwinEngineFromEnv(process.env).regenerate(
    {
      signature,
      evidence: twin.sourceRefs,
      variation,
    },
    { signal: lease.signal },
  );
  await deliverTwinEvents(iterator, lease, target);
};

const deliverTwinEvents = async (
  iterator: AsyncGenerator<TwinEvent>,
  lease: GenerationLease,
  target: BrowserWindow,
): Promise<void> => {
  activeIterator = iterator;
  try {
    for await (const event of iterator) {
      if (!canDeliverToSidecar(lease, target)) return;
      if (event.state === "recognized") {
        generation.releasePrivateInput(lease);
        activePatternId = event.signature.patternId;
        activeSignature = event.signature;
        recognitionMs = Math.round(performance.now() - invocationStartedAt);
      } else if (event.state === "complete") {
        activeTwin = event.twin;
        fullMappingMs = Math.round(performance.now() - invocationStartedAt);
      }
      if (canDeliverToSidecar(lease, target)) {
        target.webContents.send("parallel:twin-event", event);
      }
    }
  } catch (error) {
    if (canDeliverToSidecar(lease, target)) {
      target.webContents.send("parallel:twin-event", {
        state: "error",
        message:
          error instanceof Error ? error.message : "Twin generation failed",
      } satisfies TwinEvent);
    }
  } finally {
    generation.releasePrivateInput(lease);
    if (activeIterator === iterator) activeIterator = null;
  }
};

const showSidecar = async (
  cropDataUrl: string,
  lassoBounds: Rectangle,
): Promise<void> => {
  if (!activeDisplayBounds) {
    throw new Error("Capture display bounds are unavailable.");
  }
  activeLassoBounds = lassoBounds;
  const preserveImportReference =
    activeCaptureView === "import" &&
    captureWindow !== null &&
    !captureWindow.isDestroyed();
  importReferenceLocked = preserveImportReference;
  if (!preserveImportReference) {
    if (captureWindow && !captureWindow.isDestroyed()) captureWindow.close();
    captureWindow = null;
    activeCaptureView = null;
  }

  const bounds = chooseSidecarBounds(lassoBounds, activeDisplayBounds, {
    width: 380,
    height: 520,
  });
  const target = new BrowserWindow({
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
  sidecarWindow = target;
  keepOverlayVisibleAcrossSpaces(target);
  target.once("closed", () => {
    if (sidecarWindow === target) {
      cancelActiveIterator();
      generation.invalidate();
      sidecarWindow = null;
      if (mappingWindow && !mappingWindow.isDestroyed()) mappingWindow.close();
      mappingWindow = null;
      if (
        importReferenceLocked &&
        captureWindow &&
        !captureWindow.isDestroyed()
      ) {
        captureWindow.close();
      }
      captureWindow = null;
      activeCaptureView = null;
      importReferenceLocked = false;
      clearActiveTwin();
    }
  });
  await loadView(target, "sidecar");
  if (target.isDestroyed() || sidecarWindow !== target) return;
  void runGuarded(
    () => runTwinGeneration(cropDataUrl, target),
    showUnexpectedFailure,
  );
};

const showMapping = async (anchorIds: string[]): Promise<void> => {
  if (!activeDisplayBounds || !activeLassoBounds || anchorIds.length === 0) {
    if (mappingWindow && !mappingWindow.isDestroyed()) mappingWindow.close();
    mappingWindow = null;
    return;
  }
  const regionByAnchor = new Map(
    activeSignature?.originalAnchorRegions.map((anchor) => [
      anchor.anchorId,
      anchor.region,
    ]) ?? [],
  );
  const edgeByAnchor = new Map(
    activeTwin?.mappingEdges.map((edge) => [edge.originalAnchorId, edge]) ?? [],
  );
  const highlights: MappingHighlight[] = anchorIds.flatMap((anchorId) => {
    const edge = edgeByAnchor.get(anchorId);
    const region = regionByAnchor.get(anchorId);
    return edge && region
      ? [
          {
            anchorId,
            label: edge.label,
            workedStepIds: edge.workedStepIds,
            region,
          },
        ]
      : [];
  });
  if (highlights.length !== anchorIds.length) {
    throw new Error("Mapping anchors are no longer available");
  }
  if (!mappingWindow || mappingWindow.isDestroyed()) {
    const target = new BrowserWindow({
      ...activeDisplayBounds,
      ...secureWindowOptions,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      focusable: false,
      skipTaskbar: true,
    });
    mappingWindow = target;
    keepOverlayVisibleAcrossSpaces(target);
    target.setIgnoreMouseEvents(true);
    await loadView(target, "mapping");
    if (target.isDestroyed() || mappingWindow !== target) return;
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

const recordOutcome = (outcome: RendererOutcome): void => {
  telemetry?.record({
    sessionId: activeSessionId,
    outcome,
    patternId: activePatternId,
    recognitionMs,
    fullMappingMs,
  });
  if (!precedents || !activeSignature) return;
  if (outcome === "not_same") {
    recordPrecedentFeedback(precedents, activeSignature, outcome);
    return;
  }
  if (
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
};

const regenerateTwin = (): void => {
  const target = sidecarWindow;
  const signature = activeSignature;
  const twin = activeTwin;
  if (
    !target ||
    target.isDestroyed() ||
    !signature ||
    !twin
  ) {
    throw new Error("The twin session has expired. Capture again.");
  }
  const variation = activeVariation + 1;
  recordOutcome("another_twin");
  if (mappingWindow && !mappingWindow.isDestroyed()) mappingWindow.close();
  mappingWindow = null;
  target.webContents.send("parallel:twin-reset");
  resetAttemptState(variation);
  void runGuarded(
    () =>
      runTwinRegeneration(
        signature,
        twin,
        variation,
        target,
      ),
    showUnexpectedFailure,
  );
};

ipcMain.handle("parallel:start-capture", (event, ...args: unknown[]) => {
  assertActiveOverlaySender(event);
  validateNoPayload(args);
  return runGuarded(openCapture, showUnexpectedFailure);
});
ipcMain.handle("parallel:get-capture-context", (event, ...args: unknown[]) => {
  assertWindowSender(event, captureWindow, "import");
  validateNoPayload(args);
  if (!activeDisplayBounds) {
    throw new Error("No active capture display.");
  }
  return { ...activeDisplayBounds };
});
ipcMain.handle("parallel:open-screen-settings", (event, ...args: unknown[]) => {
  assertWindowSender(event, captureWindow, "import");
  validateNoPayload(args);
  return runGuarded(
    () => shell.openExternal(screenRecordingSettingsUrl),
    showUnexpectedFailure,
  );
});
ipcMain.handle("parallel:submit-crop", (event, ...args: unknown[]) => {
  assertWindowSender(event, captureWindow, activeCaptureView ?? undefined);
  if (importReferenceLocked) {
    throw new Error("That screenshot is already being processed.");
  }
  if (!activeDisplayBounds) throw new Error("No active capture display.");
  const validated = validateCropPayload(
    validateSinglePayload(args),
    activeDisplayBounds,
  );
  return runGuarded(
    () => showSidecar(validated.cropDataUrl, validated.bounds),
    showUnexpectedFailure,
  );
});
ipcMain.handle(
  "parallel:set-mapping-highlights",
  (event, ...args: unknown[]) => {
    assertWindowSender(event, sidecarWindow);
    const allowedAnchorIds =
      activeTwin?.mappingEdges.map((edge) => edge.originalAnchorId) ?? [];
    const validated = validateAnchorIds(
      validateSinglePayload(args),
      allowedAnchorIds,
    );
    return runGuarded(() => showMapping(validated), showUnexpectedFailure);
  },
);
ipcMain.handle("parallel:dismiss", (event, ...args: unknown[]) => {
  assertActiveOverlaySender(event);
  validateNoPayload(args);
  dismiss();
});
ipcMain.handle("parallel:record-outcome", (event, ...args: unknown[]) => {
  assertWindowSender(event, sidecarWindow);
  const outcome = validateOutcome(validateSinglePayload(args));
  if (outcome === "another_twin") {
    regenerateTwin();
    return;
  }
  recordOutcome(outcome);
});
ipcMain.handle("parallel:match-precedent", (event, ...args: unknown[]) => {
  assertWindowSender(event, sidecarWindow);
  validateNoPayload(args);
  return activeSignature && precedents
    ? precedents.matchPrecedent(activeSignature)
    : null;
});

const initializeDesktop = async (): Promise<void> => {
  try {
    rendererSource = resolveRendererSource(
      process.env.PARALLEL_RENDERER_URL,
      rendererFile,
    );
  } catch (error) {
    rendererSource = resolveRendererSource(undefined, rendererFile);
    await showRecoveryNotice({
      title: "Unsafe renderer URL rejected",
      detail:
        error instanceof Error
          ? `${error.message}\n\nPARALLEL will use its packaged interface.`
          : "PARALLEL will use its packaged interface.",
      canOpenSettings: false,
    });
  }

  const databasePath = join(app.getPath("userData"), "parallel.sqlite");
  const nativeBinding = join(app.getAppPath(), "native", "better_sqlite3.node");
  telemetry = new TelemetryStore(databasePath, nativeBinding);
  precedents = new PrecedentStore(databasePath, nativeBinding);

  const registered = globalShortcut.register("Alt+Space", () => {
    void runGuarded(openCapture, showUnexpectedFailure);
  });
  if (!registered) {
    await showRecoveryNotice({
      title: "Option+Space is already in use",
      detail:
        "Close the app using this shortcut, or change that app’s shortcut, then relaunch PARALLEL.",
      canOpenSettings: false,
    });
  }
};

void runGuarded(
  async () => {
    await app.whenReady();
    await initializeDesktop();
  },
  showUnexpectedFailure,
);

app.on("will-quit", () => {
  cancelActiveIterator();
  generation.invalidate();
  telemetry?.close();
  telemetry = null;
  precedents?.close();
  precedents = null;
  globalShortcut.unregisterAll();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
