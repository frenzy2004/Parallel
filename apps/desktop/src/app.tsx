import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { TwinEventSchema, type TwinEvent } from "@parallel/contracts/events";
import { Lasso } from "./capture/Lasso.js";
import {
  MappingOverlay,
  type MappingRect,
} from "./mapping/MappingOverlay.js";
import { Sidecar } from "./sidecar/Sidecar.js";
import "./styles.css";

const view = new URLSearchParams(window.location.search).get("view") ?? "sidecar";

function CaptureView(): JSX.Element {
  const [captureDataUrl, setCaptureDataUrl] = useState("");
  useEffect(() => window.parallel.onCaptureSource(setCaptureDataUrl), []);
  return (
    <Lasso
      captureDataUrl={captureDataUrl}
      onSubmit={(cropDataUrl, bounds) => {
        void window.parallel.submitCrop({ cropDataUrl, bounds });
      }}
      onDismiss={() => void window.parallel.dismiss()}
    />
  );
}

function SidecarView(): JSX.Element {
  const [events, setEvents] = useState<TwinEvent[]>([]);
  useEffect(
    () =>
      window.parallel.onTwinEvent((event) => {
        const parsed = TwinEventSchema.safeParse(event);
        if (parsed.success) {
          setEvents((current) => [...current, parsed.data]);
        }
      }),
    [],
  );
  return (
    <Sidecar
      events={events}
      onDismiss={() => void window.parallel.dismiss()}
      onMap={(anchorIds) =>
        void window.parallel.setMappingHighlights(anchorIds)
      }
    />
  );
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
