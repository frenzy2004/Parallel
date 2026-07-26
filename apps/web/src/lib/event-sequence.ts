import type { TwinRender, WorkedStep } from "@parallel/contracts";
import type { TwinEvent } from "@parallel/contracts/events";

const sameStep = (left: WorkedStep, right: WorkedStep): boolean =>
  left.id === right.id &&
  left.explanation === right.explanation &&
  left.expression === right.expression;

const completesRecognizedTwin = (
  event: Extract<TwinEvent, { state: "complete" }>,
  recognized: Extract<TwinEvent, { state: "recognized" }> | null,
  streamedSteps: WorkedStep[],
): boolean => {
  if (!recognized || recognized.signature.patternId !== event.twin.patternId) {
    return false;
  }
  return (
    streamedSteps.length === event.twin.workedSteps.length &&
    streamedSteps.every((step, index) =>
      sameStep(step, event.twin.workedSteps[index]!),
    )
  );
};

export const isValidTwinEventSequence = (events: TwinEvent[]): boolean => {
  if (events.length < 2 || events[0]?.state !== "reading") return false;

  let recognized: Extract<TwinEvent, { state: "recognized" }> | null = null;
  const streamedSteps: TwinRender["workedSteps"] = [];

  for (const [index, event] of events.entries()) {
    if (event.state === "reading") {
      if (index !== 0) return false;
      continue;
    }
    if (event.state === "recognized") {
      if (recognized || streamedSteps.length > 0) return false;
      recognized = event;
      continue;
    }
    if (event.state === "twin_step") {
      if (!recognized || event.index !== streamedSteps.length) return false;
      streamedSteps.push(event.step);
      continue;
    }

    const isLast = index === events.length - 1;
    if (!isLast) return false;
    if (event.state === "complete") {
      return completesRecognizedTwin(event, recognized, streamedSteps);
    }
    if (event.state === "unsupported" || event.state === "recapture") {
      return recognized === null && streamedSteps.length === 0;
    }
    return event.state === "error";
  }

  return false;
};
