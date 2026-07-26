import { contextBridge, ipcRenderer } from "electron";

const bridge = {
  startCapture: (): Promise<void> => ipcRenderer.invoke("parallel:start-capture"),
  getCaptureContext: (): Promise<{
    x: number;
    y: number;
    width: number;
    height: number;
  }> => ipcRenderer.invoke("parallel:get-capture-context"),
  openScreenSettings: (): Promise<void> =>
    ipcRenderer.invoke("parallel:open-screen-settings"),
  submitCrop: (payload: {
    cropDataUrl: string;
    bounds: { x: number; y: number; width: number; height: number };
  }): Promise<void> => ipcRenderer.invoke("parallel:submit-crop", payload),
  setMappingHighlights: (anchorIds: string[]): Promise<void> =>
    ipcRenderer.invoke("parallel:set-mapping-highlights", anchorIds),
  dismiss: (): Promise<void> => ipcRenderer.invoke("parallel:dismiss"),
  recordOutcome: (
    outcome: "unlocked" | "wrong_twin" | "not_same",
  ): Promise<void> => ipcRenderer.invoke("parallel:record-outcome", outcome),
  regenerateTwin: (): Promise<void> =>
    ipcRenderer.invoke("parallel:record-outcome", "another_twin"),
  matchPrecedent: (): Promise<unknown> =>
    ipcRenderer.invoke("parallel:match-precedent"),
  onCaptureSource: (listener: (dataUrl: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, dataUrl: string) =>
      listener(dataUrl);
    ipcRenderer.on("parallel:capture-source", handler);
    return () => ipcRenderer.removeListener("parallel:capture-source", handler);
  },
  onTwinEvent: (
    listener: (event: unknown) => void,
  ): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) =>
      listener(data);
    ipcRenderer.on("parallel:twin-event", handler);
    return () => ipcRenderer.removeListener("parallel:twin-event", handler);
  },
  onTwinReset: (listener: () => void): (() => void) => {
    const handler = () => listener();
    ipcRenderer.on("parallel:twin-reset", handler);
    return () => ipcRenderer.removeListener("parallel:twin-reset", handler);
  },
  onMappingRects: (listener: (rects: unknown) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, rects: unknown) =>
      listener(rects);
    ipcRenderer.on("parallel:mapping-rects", handler);
    return () => ipcRenderer.removeListener("parallel:mapping-rects", handler);
  },
};

contextBridge.exposeInMainWorld("parallel", bridge);

export type ParallelBridge = typeof bridge;
