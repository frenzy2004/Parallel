"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import type { StructuralSignature, TwinRender } from "@parallel/contracts";
import { TwinEventSchema, type TwinEvent } from "@parallel/contracts/events";
import { ProblemStage, type MappingHighlight } from "./problem-stage";
import { ResultPanel } from "./result-panel";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

type WorkspaceMode = "upload" | "demo";

const errorMessageFrom = (payload: unknown): string => {
  if (typeof payload !== "object" || payload === null) {
    return "The analysis service returned an unreadable response.";
  }
  const record = payload as Record<string, unknown>;
  if (typeof record.message === "string") return record.message;
  if (typeof record.error === "string") return record.error;
  if (typeof record.error === "object" && record.error !== null) {
    const message = (record.error as Record<string, unknown>).message;
    if (typeof message === "string") return message;
  }
  return "The analysis service could not complete this request.";
};

const eventsFrom = (payload: unknown): TwinEvent[] => {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("The analysis service returned an unreadable response.");
  }
  const parsed = TwinEventSchema.array().safeParse(
    (payload as Record<string, unknown>).events,
  );
  if (!parsed.success) {
    throw new Error("The analysis service returned an invalid twin.");
  }
  return parsed.data;
};

const mappedHighlights = (
  signature: StructuralSignature | null,
  twin: TwinRender | null,
  activeStepId: string | null,
): MappingHighlight[] => {
  if (!signature || !twin || !activeStepId) return [];
  const regions = new Map(
    signature.originalAnchorRegions.map(({ anchorId, region }) => [
      anchorId,
      region,
    ]),
  );
  const unique = new Set<string>();
  return twin.mappingEdges.flatMap((edge) => {
    if (
      !edge.workedStepIds.includes(activeStepId) ||
      unique.has(edge.originalAnchorId)
    ) {
      return [];
    }
    const region = regions.get(edge.originalAnchorId);
    if (!region) return [];
    unique.add(edge.originalAnchorId);
    return [
      {
        anchorId: edge.originalAnchorId,
        label: edge.label,
        region,
      },
    ];
  });
};

export function ParallelWorkspace(): JSX.Element {
  const [mode, setMode] = useState<WorkspaceMode>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [events, setEvents] = useState<TwinEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredStepId, setHoveredStepId] = useState<string | null>(null);
  const [focusedStepId, setFocusedStepId] = useState<string | null>(null);
  const [pinnedStepId, setPinnedStepId] = useState<string | null>(null);
  const requestEpoch = useRef(0);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(
    () => () => {
      controller.current?.abort();
    },
    [],
  );

  const resetResult = useCallback(() => {
    requestEpoch.current += 1;
    controller.current?.abort();
    controller.current = null;
    setEvents([]);
    setError(null);
    setIsLoading(false);
    setHoveredStepId(null);
    setFocusedStepId(null);
    setPinnedStepId(null);
  }, []);

  const selectFile = useCallback(
    (file: File) => {
      resetResult();
      if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
        setSelectedFile(null);
        setPreviewUrl(null);
        setMode("upload");
        setError("Choose a PNG, JPEG or WebP screenshot.");
        return;
      }
      if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
        setSelectedFile(null);
        setPreviewUrl(null);
        setMode("upload");
        setError("Choose a non-empty screenshot smaller than 4 MB.");
        return;
      }
      setMode("upload");
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    },
    [resetResult],
  );

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const image = Array.from(event.clipboardData?.files ?? []).find((file) =>
        ACCEPTED_IMAGE_TYPES.has(file.type),
      );
      if (image) {
        event.preventDefault();
        selectFile(image);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [selectFile]);

  const runRequest = useCallback(
    async (nextMode: WorkspaceMode) => {
      if (nextMode === "upload" && !selectedFile) return;

      const epoch = requestEpoch.current + 1;
      requestEpoch.current = epoch;
      controller.current?.abort();
      const nextController = new AbortController();
      controller.current = nextController;
      setMode(nextMode);
      setEvents([]);
      setError(null);
      setIsLoading(true);
      setHoveredStepId(null);
      setFocusedStepId(null);
      setPinnedStepId(null);

      if (nextMode === "demo") {
        setSelectedFile(null);
        setPreviewUrl(null);
      }

      try {
        let response: Response;
        if (nextMode === "demo") {
          response = await fetch("/api/demo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fixtureId: "moment-about-point-v1" }),
            signal: nextController.signal,
          });
        } else {
          const body = new FormData();
          body.set("crop", selectedFile as File);
          body.set("coursePackId", "statics-2d");
          response = await fetch("/api/twins", {
            method: "POST",
            body,
            signal: nextController.signal,
          });
        }
        const payload: unknown = await response.json();
        if (!response.ok) throw new Error(errorMessageFrom(payload));
        const nextEvents = eventsFrom(payload);
        if (requestEpoch.current === epoch) setEvents(nextEvents);
      } catch (caught) {
        if (
          requestEpoch.current !== epoch ||
          (caught instanceof DOMException && caught.name === "AbortError")
        ) {
          return;
        }
        setError(
          caught instanceof Error
            ? caught.message
            : "The analysis service could not complete this request.",
        );
      } finally {
        if (requestEpoch.current === epoch) {
          setIsLoading(false);
          controller.current = null;
        }
      }
    },
    [selectedFile],
  );

  const recognized = events.findLast((event) => event.state === "recognized");
  const complete = events.findLast((event) => event.state === "complete");
  const activeStepId = hoveredStepId ?? focusedStepId ?? pinnedStepId;
  const highlights = useMemo(
    () =>
      mappedHighlights(
        recognized?.state === "recognized" ? recognized.signature : null,
        complete?.state === "complete" ? complete.twin : null,
        activeStepId,
      ),
    [activeStepId, complete, recognized],
  );

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="PARALLEL home">
          <span className="wordmark-mark" aria-hidden="true">
            <i />
            <i />
          </span>
          <span>PARALLEL</span>
        </a>
        <div className="topbar-context">
          <span>Structural transfer workspace</span>
          <span className="topbar-divider" aria-hidden="true" />
          <span className="private-status">
            <i aria-hidden="true" />
            No screen recording · no saved images
          </span>
        </div>
        <a
          className="course-pack"
          href="#workspace"
          aria-label="Current course pack: 2D Statics"
        >
          <span>Course pack</span>
          <strong>2D Statics</strong>
        </a>
      </header>

      <section className="action-strip" aria-label="Analysis controls">
        <div className="action-intro">
          <span className="eyebrow">Your next move, not the answer</span>
          <h1>See the same structure in a different problem.</h1>
        </div>
        <div className="action-controls">
          <label className="upload-control">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              aria-label="Choose a screenshot"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) selectFile(file);
                event.currentTarget.value = "";
              }}
            />
            <span className="button-icon" aria-hidden="true">
              ↑
            </span>
            <span>{selectedFile ? "Replace screenshot" : "Choose screenshot"}</span>
          </label>
          <button
            className="analyze-button"
            type="button"
            disabled={!selectedFile || isLoading}
            onClick={() => void runRequest("upload")}
          >
            <span className="button-spark" aria-hidden="true">
              ✦
            </span>
            Analyze my screenshot
          </button>
          <span className="action-or">or</span>
          <button
            className="demo-button"
            type="button"
            disabled={isLoading}
            onClick={() => void runRequest("demo")}
          >
            Try bundled Statics demo
          </button>
        </div>
      </section>

      <div className="workspace-grid" id="workspace">
        <ProblemStage
          mode={mode}
          previewUrl={previewUrl}
          fileName={selectedFile?.name ?? null}
          highlights={highlights}
          isDragging={isDragging}
          onDragEnter={() => setIsDragging(true)}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            const file = event.dataTransfer.files[0];
            if (file) selectFile(file);
          }}
        />
        <ResultPanel
          events={events}
          isLoading={isLoading}
          error={error}
          mode={mode}
          activeStepId={activeStepId}
          pinnedStepId={pinnedStepId}
          onStepHover={setHoveredStepId}
          onStepFocus={setFocusedStepId}
          onStepPin={(stepId) =>
            setPinnedStepId((current) => (current === stepId ? null : stepId))
          }
        />
      </div>

      <footer className="app-footer">
        <span>PARALLEL currently recognizes six canonical 2D Statics patterns.</span>
        <span>
          Unsupported topics are refused, never guessed.
          <i aria-hidden="true" />
          v0.1
        </span>
      </footer>
    </main>
  );
}
