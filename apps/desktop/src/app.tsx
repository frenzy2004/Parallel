import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Lasso } from "./capture/Lasso.js";
import {
  MappingOverlay,
  type MappingRect,
} from "./mapping/MappingOverlay.js";
import { SidecarSession } from "./sidecar/SidecarSession.js";
import "./styles.css";

const view = new URLSearchParams(window.location.search).get("view") ?? "sidecar";
const ignoreHandledFailure = (work: Promise<unknown>): void => {
  void work.catch(() => undefined);
};

function CaptureView(): JSX.Element {
  const [captureDataUrl, setCaptureDataUrl] = useState("");
  useEffect(() => window.parallel.onCaptureSource(setCaptureDataUrl), []);
  return (
    <Lasso
      captureDataUrl={captureDataUrl}
      onSubmit={(cropDataUrl, bounds) => {
        ignoreHandledFailure(
          window.parallel.submitCrop({ cropDataUrl, bounds }),
        );
      }}
      onDismiss={() => ignoreHandledFailure(window.parallel.dismiss())}
    />
  );
}

function SidecarView(): JSX.Element {
  return <SidecarSession bridge={window.parallel} />;
}

function MappingView(): JSX.Element {
  const [rectangles, setRectangles] = useState<MappingRect[]>([]);
  useEffect(
    () =>
      window.parallel.onMappingRects((payload) => {
        if (Array.isArray(payload)) setRectangles(payload as MappingRect[]);
      }),
    [],
  );
  return <MappingOverlay rectangles={rectangles} />;
}

const root = createRoot(document.getElementById("root")!);
root.render(
  <StrictMode>
    {view === "capture" ? (
      <CaptureView />
    ) : view === "mapping" ? (
      <MappingView />
    ) : (
      <SidecarView />
    )}
  </StrictMode>,
);
