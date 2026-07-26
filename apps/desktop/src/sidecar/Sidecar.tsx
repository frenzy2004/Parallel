import { useEffect, useMemo, useState } from "react";
import type { TwinEvent } from "@parallel/contracts/events";

interface SidecarProps {
  events: TwinEvent[];
  onDismiss(): void;
  onMap?(anchorIds: string[]): void;
  onOutcome?(outcome: "unlocked" | "wrong_twin" | "another_twin"): void;
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
}: SidecarProps): JSX.Element {
  const [mappingVisible, setMappingVisible] = useState(false);
  const current = events.at(-1);
  const recognized = events.find((event) => event.state === "recognized");
  const complete = events.findLast((event) => event.state === "complete");
  const streamedSteps = events.filter((event) => event.state === "twin_step");
  const anchorIds = useMemo(
    () =>
      complete?.state === "complete"
        ? complete.twin.mappingEdges.map((edge) => edge.originalAnchorId)
        : [],
    [complete],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "escape") onDismiss();
      if (key === "m") {
        setMappingVisible((visible) => {
          onMap(visible ? [] : anchorIds);
          return !visible;
        });
      }
      if (key === "n") onOutcome("another_twin");
      if (key === "u") onOutcome("unlocked");
      if (key === "x") onOutcome("wrong_twin");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [anchorIds, onDismiss, onMap, onOutcome]);

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
              onMouseEnter={() => onMap(anchorIds)}
              onMouseLeave={() => !mappingVisible && onMap([])}
            >
              <span>{event.step.explanation}</span>
              <code>{event.step.expression}</code>
            </li>
          ) : null,
        )}
      </ol>
      {complete?.state === "complete" ? (
        <footer>
          <button onClick={() => onMap(mappingVisible ? [] : anchorIds)}>
            Map <kbd>M</kbd>
          </button>
          <button onClick={() => onOutcome("another_twin")}>
            Another <kbd>N</kbd>
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

export { announcementFor };
