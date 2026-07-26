import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Lasso } from "./capture/Lasso.js";
import { ScreenshotImport } from "./capture/ScreenshotImport.js";
import type { ImportRectangle } from "./capture/import-image.js";
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

function ImportView(): JSX.Element {
  const [displayBounds, setDisplayBounds] = useState<ImportRectangle | null>(
    null,
  );
  const [contextError, setContextError] = useState("");
  useEffect(() => {
    let active = true;
    void window.parallel
      .getCaptureContext()
      .then((bounds) => {
        if (active) setDisplayBounds(bounds);
      })
      .catch(() => {
        if (active) {
          setContextError(
            "PARALLEL could not prepare screenshot import. Close and try again.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  if (contextError) {
    return (
      <main className="import-shell import-unavailable">
        <span className="brand">PARALLEL</span>
        <h1>Import is unavailable</h1>
        <p role="alert">{contextError}</p>
        <button
          type="button"
          onClick={() => ignoreHandledFailure(window.parallel.dismiss())}
        >
          Close
        </button>
      </main>
    );
  }
  if (!displayBounds) {
    return (
      <main className="import-shell import-loading" aria-busy="true">
        <span className="brand">PARALLEL</span>
        <p>Preparing private import…</p>
      </main>
    );
  }
  return (
    <ScreenshotImport
      displayBounds={displayBounds}
      onSubmit={(cropDataUrl, bounds) => {
        ignoreHandledFailure(
          window.parallel.submitCrop({ cropDataUrl, bounds }),
        );
      }}
      onDismiss={() => ignoreHandledFailure(window.parallel.dismiss())}
      onOpenScreenSettings={() =>
        ignoreHandledFailure(window.parallel.openScreenSettings())
      }
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
    ) : view === "import" ? (
      <ImportView />
    ) : view === "mapping" ? (
      <MappingView />
    ) : (
      <SidecarView />
    )}
  </StrictMode>,
);
