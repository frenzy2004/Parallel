import { contextBridge, ipcRenderer } from "electron";
const bridge = {
    startCapture: () => ipcRenderer.invoke("parallel:start-capture"),
    submitCrop: (payload) => ipcRenderer.invoke("parallel:submit-crop", payload),
    setMappingHighlights: (anchorIds) => ipcRenderer.invoke("parallel:set-mapping-highlights", anchorIds),
    dismiss: () => ipcRenderer.invoke("parallel:dismiss"),
    onCaptureSource: (listener) => {
        const handler = (_event, dataUrl) => listener(dataUrl);
        ipcRenderer.on("parallel:capture-source", handler);
        return () => ipcRenderer.removeListener("parallel:capture-source", handler);
    },
    onTwinEvent: (listener) => {
        const handler = (_event, data) => listener(data);
        ipcRenderer.on("parallel:twin-event", handler);
        return () => ipcRenderer.removeListener("parallel:twin-event", handler);
    },
    onMappingRects: (listener) => {
        const handler = (_event, rects) => listener(rects);
        ipcRenderer.on("parallel:mapping-rects", handler);
        return () => ipcRenderer.removeListener("parallel:mapping-rects", handler);
    },
};
contextBridge.exposeInMainWorld("parallel", bridge);
//# sourceMappingURL=preload.js.map