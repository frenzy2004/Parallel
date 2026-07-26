import { contextBridge, ipcRenderer } from "electron";
import type { StructuralSignature } from "@parallel/contracts";

const bridge = {
  startCapture: (): Promise<void> => ipcRenderer.invoke("parallel:start-capture"),
  submitCrop: (payload: {
    cropDataUrl: string;
    bounds: { x: number; y: number; width: number; height: number };
  }): Promise<void> => ipcRenderer.invoke("parallel:submit-crop", payload),
  setMappingHighlights: (anchorIds: string[]): Promise<void> =>
    ipcRenderer.invoke("parallel:set-mapping-highlights", anchorIds),
  dismiss: (): Promise<void> => ipcRenderer.invoke("parallel:dismiss"),
  recordOutcome: (
    outcome: "unlocked" | "wrong_twin" | "another_twin",
  ): Promise<void> => ipcRenderer.invoke("parallel:record-outcome", outcome),
  matchPrecedent: (signature: StructuralSignature): Promise<unknown> =>
    ipcRenderer.invoke("parallel:match-precedent", signature),
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
  onMappingRects: (listener: (rects: unknown) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, rects: unknown) =>
      listener(rects);
    ipcRenderer.on("parallel:mapping-rects", handler);
    return () => ipcRenderer.removeListener("parallel:mapping-rects", handler);
  },
};

contextBridge.exposeInMainWorld("parallel", bridge);

export type ParallelBridge = typeof bridge;
