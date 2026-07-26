import { useCallback, useEffect, useMemo, useState } from "react";
import type { JSX } from "react";
import type { Precedent } from "@parallel/contracts";
import type { TwinEvent } from "@parallel/contracts/events";
import type { NormalizedRegion } from "@parallel/contracts";

export interface MappingHighlight {
  anchorId: string;
  label: string;
  workedStepIds: string[];
  region: NormalizedRegion;
}

export interface PrecedentMatchView {
  precedent: Precedent;
  score: number;
}

interface SidecarProps {
  events: TwinEvent[];
  onDismiss(): void;
  onMap?(highlights: MappingHighlight[]): void;
  onOutcome?(outcome: "unlocked" | "wrong_twin"): void;
  onAnother?(): void;
  precedentMatch?: PrecedentMatchView | null;
  onPrecedentFeedback?(): void;
}

const announcementFor = (event: TwinEvent | undefined): string => {
  if (!event) return "Waiting for selection";
  switch (event.state) {
    case "reading":
      return "Reading selection";
    case "recognized":
      return `Recognized: ${event.label}`;
    case "twin_step":
      return `Twin step ${event.index + 1}: ${event.step.explanation}`;
    case "complete":
      return "Twin complete. Correspondence map ready.";
    case "recapture":
      return `Recapture needed: ${event.reason}`;
    case "unsupported":
      return `Unsupported selection: ${event.reason}`;
    case "error":
      return `Error: ${event.message}`;
  }
};

export function Sidecar({
  events,
  onDismiss,
  onMap = () => undefined,
  onOutcome = () => undefined,
  onAnother,
  precedentMatch = null,
  onPrecedentFeedback = () => undefined,
}: SidecarProps): JSX.Element {
  const [mappingVisible, setMappingVisible] = useState(false);
  const [sourcesVisible, setSourcesVisible] = useState(false);
  const current = events.at(-1);
  const recognized = events.find((event) => event.state === "recognized");
  const complete = events.findLast((event) => event.state === "complete");
  const streamedSteps = events.filter((event) => event.state === "twin_step");
  const highlights = useMemo(
    () => {
      if (
        complete?.state !== "complete" ||
        recognized?.state !== "recognized"
      ) {
        return [];
      }
      const regionByAnchor = new Map(
        recognized.signature.originalAnchorRegions.map((anchor) => [
          anchor.anchorId,
          anchor.region,
        ]),
      );
      return complete.twin.mappingEdges.flatMap((edge) => {
        const region = regionByAnchor.get(edge.originalAnchorId);
        return region
          ? [{
              anchorId: edge.originalAnchorId,
              label: edge.label,
              workedStepIds: edge.workedStepIds ?? [],
              region,
            }]
          : [];
      });
    },
    [complete, recognized],
  );
  const toggleMapping = useCallback(() => {
    setMappingVisible((visible) => {
      onMap(visible ? [] : highlights);
      return !visible;
    });
  }, [highlights, onMap]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "escape") onDismiss();
      if (key === "m") toggleMapping();
      if (key === "n") onAnother?.();
      if (key === "u") onOutcome("unlocked");
      if (key === "x") onOutcome("wrong_twin");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onAnother, onDismiss, onOutcome, toggleMapping]);

  return (
    <main className="sidecar-shell">
      <header>
        <span className="brand">PARALLEL</span>
        <button aria-label="Dismiss" onClick={onDismiss}>
          Esc
        </button>
      </header>
      <div className="state-pill" role="status" aria-live="polite">
        {announcementFor(current)}
      </div>
      {recognized?.state === "recognized" ? (
        <section>
          <div className="eyebrow">Pattern</div>
          <h1>{recognized.label}</h1>
        </section>
      ) : null}
      {recognized?.state === "recognized" && precedentMatch ? (
        <aside className="precedent-card" aria-label="Personal Precedent">
          <div>
            <div className="eyebrow">Personal Precedent</div>
            <strong>Verified local shape match</strong>
            <span>Prior twin reopened</span>
          </div>
          <p>{precedentMatch.precedent.mappingSummary}</p>
          <button onClick={onPrecedentFeedback}>Not same</button>
        </aside>
      ) : null}
      {complete?.state === "complete" ? (
        <section>
          <div className="eyebrow">Worked structural twin</div>
          <p className="twin-statement">{complete.twin.twinStatement}</p>
        </section>
      ) : null}
      <ol className="worked-steps">
        {streamedSteps.map((event) =>
          event.state === "twin_step" ? (
            <li
              key={event.step.id}
              onMouseEnter={() => {
                if (!mappingVisible) {
                  onMap(
                    highlights.filter((highlight) =>
                      highlight.workedStepIds.includes(event.step.id),
                    ),
                  );
                }
              }}
              onMouseLeave={() => !mappingVisible && onMap([])}
            >
              <span>{event.step.explanation}</span>
              <code>{event.step.expression}</code>
            </li>
          ) : null,
        )}
      </ol>
      {complete?.state === "complete" ? (
        <section
          className="sources-shelf"
          aria-label="Sources and confidence"
        >
          <button
            className="sources-toggle"
            aria-expanded={sourcesVisible}
            aria-controls="sources-shelf-content"
            onClick={() => setSourcesVisible((visible) => !visible)}
          >
            <span>Sources &amp; confidence</span>
            <span className="sources-summary">
              {Math.round(complete.twin.confidence * 100)}% structure
              confidence ·{" "}
              {complete.twin.sourceRefs.length === 0
                ? "sources unavailable"
                : `${complete.twin.sourceRefs.length} teaching ${
                    complete.twin.sourceRefs.length === 1
                      ? "source"
                      : "sources"
                  }`}
            </span>
            <span className="sources-caret" aria-hidden="true">
              {sourcesVisible ? "−" : "+"}
            </span>
          </button>
          {sourcesVisible ? (
            <div id="sources-shelf-content" className="sources-content">
              {complete.twin.sourceRefs.length === 0 ? (
                <p>
                  Teaching sources are unavailable. The worked twin is still
                  verified locally.
                </p>
              ) : (
                <ul>
                  {complete.twin.sourceRefs.map((source) => (
                    <li key={source.url}>
                      <strong>{source.title}</strong>
                      <span>{sourceDomain(source.url)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </section>
      ) : null}
      {complete?.state === "complete" ? (
        <footer>
          <button onClick={toggleMapping}>
            Map <kbd>M</kbd>
          </button>
          <button onClick={onAnother} disabled={!onAnother}>
            {onAnother ? "Regenerate" : "Regeneration unavailable"}{" "}
            <kbd>N</kbd>
          </button>
          <button className="primary" onClick={() => onOutcome("unlocked")}>
            Unlocked <kbd>U</kbd>
          </button>
          <button onClick={() => onOutcome("wrong_twin")}>
            Wrong twin <kbd>X</kbd>
          </button>
        </footer>
      ) : null}
    </main>
  );
}

const sourceDomain = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Teaching source";
  }
};

export { announcementFor };
