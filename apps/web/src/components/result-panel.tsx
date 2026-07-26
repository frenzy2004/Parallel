import type { TwinEvent } from "@parallel/contracts/events";
import type { JSX } from "react";

interface ResultPanelProps {
  events: TwinEvent[];
  isLoading: boolean;
  error: string | null;
  mode: "upload" | "demo";
  activeStepId: string | null;
  pinnedStepId: string | null;
  onStepHover(stepId: string | null): void;
  onStepFocus(stepId: string | null): void;
  onStepPin(stepId: string): void;
}

const humanizePattern = (patternId: string): string =>
  patternId
    .split("_")
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(" ");

const sourceDomain = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Teaching source";
  }
};

export function ResultPanel({
  events,
  isLoading,
  error,
  mode,
  activeStepId,
  pinnedStepId,
  onStepHover,
  onStepFocus,
  onStepPin,
}: ResultPanelProps): JSX.Element {
  const recognized = events.findLast((event) => event.state === "recognized");
  const complete = events.findLast((event) => event.state === "complete");
  const terminal = events.findLast(
    (event) =>
      event.state === "unsupported" ||
      event.state === "recapture" ||
      event.state === "error",
  );
  const announcement = isLoading
    ? "Analysis in progress."
    : error
      ? "Analysis failed. Review the visible error message."
      : terminal
        ? terminal.state === "error"
          ? "Analysis failed. Review the visible error message."
          : terminal.state === "recapture"
            ? "Recapture needed. Review the visible guidance."
            : "Unsupported selection. Review the visible reason."
        : complete?.state === "complete"
          ? "Twin complete. Focus a worked step to map it to the original problem."
          : "Ready for a 2D Statics screenshot.";

  return (
    <section className="result-card" aria-label="Structural twin">
      <div className="panel-heading">
        <div>
          <span className="section-index">02</span>
          <h2>Structural twin</h2>
        </div>
        <span className="course-chip">2D Statics</span>
      </div>

      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>
      <div className="result-scroll">
        {mode === "demo" ? (
          <div className="demo-truth">
            <span className="demo-truth-icon" aria-hidden="true">
              D
            </span>
            <div>
              <strong>Bundled fixed demo — no screenshot analyzed</strong>
              <p>
                This known fixture proves the interaction only. Your own image
                always uses live recognition.
              </p>
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <div className="loading-state">
            <div className="scan-mark" aria-hidden="true">
              <span />
            </div>
            <span className="eyebrow">Reading the structure</span>
            <h3>Finding forces, constraints and the invariant…</h3>
            <p>Usually a few seconds. No answer from the original is copied.</p>
          </div>
        ) : null}

        {!isLoading && error ? (
          <div className="terminal-state error-state">
            <span className="terminal-symbol" aria-hidden="true">
              !
            </span>
            <span className="eyebrow">Analysis unavailable</span>
            <h3>We couldn’t build this twin.</h3>
            <p>{error}</p>
            <small>
              Your screenshot stayed in this request and was not retained.
            </small>
          </div>
        ) : null}

        {!isLoading && !error && terminal ? (
          <div className="terminal-state refusal-state">
            <span className="terminal-symbol" aria-hidden="true">
              ↗
            </span>
            <span className="eyebrow">
              {terminal.state === "error"
                ? "Analysis failed"
                : terminal.state === "recapture"
                ? "Needs a clearer crop"
                : "Outside this course pack"}
            </span>
            <h3>
              {terminal.state === "error"
                ? "We couldn’t finish this twin."
                : terminal.state === "recapture"
                ? "Give PARALLEL a little more context."
                : "This isn’t a supported 2D Statics problem."}
            </h3>
            <p>
              {terminal.state === "error"
                ? terminal.message
                : terminal.reason}
            </p>
            <small>
              {terminal.state === "error"
                ? "Nothing was invented. Your screenshot was not retained."
                : "Nothing was invented. Try a 2D Statics problem or a tighter screenshot."}
            </small>
          </div>
        ) : null}

        {!isLoading &&
        !error &&
        !terminal &&
        recognized?.state === "recognized" &&
        complete?.state === "complete" ? (
          <div className="twin-result">
            <div className="pattern-row">
              <div>
                <span className="eyebrow">Recognized pattern</span>
                <h3>{recognized.label || humanizePattern(complete.twin.patternId)}</h3>
              </div>
              <div
                className="confidence-orbit"
                aria-label={`${Math.round(
                  complete.twin.confidence * 100,
                )}% structural confidence`}
                style={
                  {
                    "--confidence": `${complete.twin.confidence * 360}deg`,
                  } as React.CSSProperties
                }
              >
                <span>{Math.round(complete.twin.confidence * 100)}</span>
                <small>%</small>
              </div>
            </div>

            <div className="statement-block">
              <span className="eyebrow">Parallel problem</span>
              <p>{complete.twin.twinStatement}</p>
            </div>

            <div className="steps-heading">
              <span className="eyebrow">Worked structural twin</span>
              <span>Focus a step to map it</span>
            </div>
            <ol className="worked-steps">
              {complete.twin.workedSteps.map((step, index) => {
                const isActive = activeStepId === step.id;
                const isPinned = pinnedStepId === step.id;
                return (
                  <li key={step.id}>
                    <button
                      type="button"
                      className={`${isActive ? "is-active" : ""}${
                        isPinned ? " is-pinned" : ""
                      }`}
                      aria-label={`${step.explanation} Map this step to the original problem.`}
                      aria-pressed={isPinned}
                      onMouseEnter={() => onStepHover(step.id)}
                      onMouseLeave={() => onStepHover(null)}
                      onFocus={() => onStepFocus(step.id)}
                      onBlur={() => onStepFocus(null)}
                      onClick={() => onStepPin(step.id)}
                    >
                      <span className="step-number">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="step-copy">
                        <strong>{step.explanation}</strong>
                        <code>{step.expression}</code>
                      </span>
                      <span className="map-indicator" aria-hidden="true">
                        {isPinned ? "Pinned" : "Map"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>

            <details className="sources-shelf">
              <summary>
                <span>
                  <strong>Sources &amp; confidence</strong>
                  <small>
                    {complete.twin.sourceRefs.length
                      ? `${complete.twin.sourceRefs.length} teaching ${
                          complete.twin.sourceRefs.length === 1
                            ? "source"
                            : "sources"
                        }`
                      : "Sources unavailable"}
                  </small>
                </span>
                <span aria-hidden="true">+</span>
              </summary>
              <div className="sources-content">
                <p>
                  Structural confidence{" "}
                  <strong>{Math.round(complete.twin.confidence * 100)}%</strong>
                </p>
                {complete.twin.sourceRefs.length ? (
                  <ul>
                    {complete.twin.sourceRefs.map((source) => (
                      <li key={source.url}>
                        <a href={source.url} target="_blank" rel="noreferrer">
                          <span>{source.title}</span>
                          <small>{sourceDomain(source.url)}</small>
                        </a>
                        <p>{source.highlight}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>
                    The twin was verified against the local Statics compiler;
                    external teaching sources were unavailable.
                  </p>
                )}
              </div>
            </details>
          </div>
        ) : null}

        {!isLoading &&
        !error &&
        !terminal &&
        (!recognized || !complete) ? (
          <div className="idle-result">
            <div className="parallel-glyph" aria-hidden="true">
              <span />
              <span />
            </div>
            <span className="eyebrow">Ready when you are</span>
            <h3>One problem in. One true structural twin out.</h3>
            <p>
              Upload a 2D Statics problem. PARALLEL identifies its deep shape,
              builds a fresh worked problem, then maps every step back onto
              your image.
            </p>
            <ul>
              <li>
                <span>01</span> Recognize the invariant
              </li>
              <li>
                <span>02</span> Build a new numeric twin
              </li>
              <li>
                <span>03</span> Map each step to your problem
              </li>
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
