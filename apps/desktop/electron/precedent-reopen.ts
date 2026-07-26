import type { TwinRender } from "@parallel/contracts";
import type { TwinEvent } from "@parallel/contracts/events";

export const eventsForReopenedTwin = (twin: TwinRender): TwinEvent[] => [
  ...twin.workedSteps.map(
    (step, index): TwinEvent => ({
      state: "twin_step",
      index,
      step,
    }),
  ),
  { state: "complete", twin },
];
