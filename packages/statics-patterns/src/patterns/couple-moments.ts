import { createPattern } from "./factory.js";

export const coupleMoments = createPattern({
  id: "couple_moments",
  label: "Couple moments",
  invariants: ["equal opposite forces", "free-vector moment M = Fd"],
  numericBounds: {
    forceN: { min: 20, max: 160 },
    distanceM: { min: 1, max: 5 },
    angleDeg: { min: 0, max: 90 },
  },
  allowedMethods: ["couple reduction", "signed algebraic sum"],
  scenarios: ["valve wheel", "steering yoke", "fixture plate"],
  statement: (_seed, scenario, force, distance) =>
    `Two equal and opposite ${force} N forces act ${distance} m apart on a ${scenario}. Replace them by an equivalent couple moment.`,
  steps: (_seed, force, distance) => [
    {
      id: "couple",
      explanation: "The net force is zero, so only the couple remains.",
      expression: "ΣF = 0",
    },
    {
      id: "moment",
      explanation: "Multiply either force by the perpendicular separation.",
      expression: `M_c = Fd = (${force})(${distance}) N·m`,
    },
  ],
  anchors: [
    {
      twinAnchorId: "force-pair",
      originalAnchorId: "opposite-force-pair",
      label: "couple force pair",
    },
  ],
});
