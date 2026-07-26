import type { NormalizedRegion } from "@parallel/contracts";
import type { JSX } from "react";
import { DemoDiagram } from "./demo-diagram";

export interface MappingHighlight {
  anchorId: string;
  label: string;
  region: NormalizedRegion;
}

interface ProblemStageProps {
  mode: "upload" | "demo";
  previewUrl: string | null;
  fileName: string | null;
  highlights: MappingHighlight[];
  isDragging: boolean;
  onDragEnter(): void;
  onDragLeave(): void;
  onDrop(event: React.DragEvent<HTMLDivElement>): void;
}

export function ProblemStage({
  mode,
  previewUrl,
  fileName,
  highlights,
  isDragging,
  onDragEnter,
  onDragLeave,
  onDrop,
}: ProblemStageProps): JSX.Element {
  const hasVisual = mode === "demo" || Boolean(previewUrl);

  return (
    <section className="problem-card" aria-label="Problem image">
      <div className="panel-heading">
        <div>
          <span className="section-index">01</span>
          <h2>Problem surface</h2>
        </div>
        {mode === "demo" ? (
          <span className="fixture-chip">Fixed fixture</span>
        ) : fileName ? (
          <span className="file-chip" title={fileName}>
            {fileName}
          </span>
        ) : (
          <span className="quiet-chip">Awaiting image</span>
        )}
      </div>

      <div
        className={`problem-surface${isDragging ? " is-dragging" : ""}${
          hasVisual ? " has-visual" : ""
        }`}
        onDragEnter={(event) => {
          event.preventDefault();
          onDragEnter();
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
            return;
          }
          onDragLeave();
        }}
        onDrop={onDrop}
      >
        {hasVisual ? (
          <div className="visual-frame">
            {mode === "demo" ? <DemoDiagram /> : null}
            {mode === "upload" && previewUrl ? (
              // A local blob keeps its natural ratio so normalized mapping stays exact.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="problem-image"
                src={previewUrl}
                alt={
                  fileName ? `Selected problem: ${fileName}` : "Selected problem"
                }
              />
            ) : null}
            {highlights.map((highlight) => (
              <span
                key={highlight.anchorId}
                className="mapping-highlight"
                data-testid="mapping-highlight"
                data-anchor-id={highlight.anchorId}
                aria-label={`Mapped region: ${highlight.label}`}
                style={{
                  left: `${highlight.region.x * 100}%`,
                  top: `${highlight.region.y * 100}%`,
                  width: `${highlight.region.width * 100}%`,
                  height: `${highlight.region.height * 100}%`,
                }}
              >
                <span>{highlight.label}</span>
              </span>
            ))}
          </div>
        ) : null}
        {!hasVisual ? (
          <div className="empty-surface">
            <div className="drop-glyph" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>
            <strong>Drop or paste one problem</strong>
            <p>PNG, JPEG or WebP · up to 4 MB</p>
            <span>⌘V works from any screenshot tool</span>
          </div>
        ) : null}
      </div>

      <div className="surface-footnote">
        <span className="memory-dot" aria-hidden="true" />
        <span>
          Previewed locally. The raw image is sent only for this analysis and is
          never added to PARALLEL memory.
        </span>
      </div>
    </section>
  );
}
