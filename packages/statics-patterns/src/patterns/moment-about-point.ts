import { createPattern } from "./factory.js";

export const momentAboutPoint = createPattern({
  id: "moment_about_point",
  label: "Moment about a point",
  invariants: ["moment equals force times perpendicular distance", "signed rotation"],
  numericBounds: {
    forceN: { min: 50, max: 200 },
    distanceM: { min: 1, max: 6 },
    angleDeg: { min: 20, max: 80 },
  },
  allowedMethods: ["scalar moment", "2D cross product"],
  scenarios: ["sign bracket", "gate handle", "machine lever"],
  statement: (_seed, scenario, force, distance) =>
    `A ${force} N downward force acts on a ${scenario} ${distance} m to the right of pin A. Determine its signed moment about A.`,
  steps: (_seed, force, distance) => [
    {
      id: "lever-arm",
      explanation: "Use the perpendicular distance from A to the force line of action.",
      expression: `d⊥ = ${distance} m`,
    },
    {
      id: "moment",
      explanation: "A downward force to the right produces clockwise rotation.",
      expression: `ΣM_A = -F d⊥ = -(${force})(${distance}) N·m`,
    },
  ],
  anchors: [
    {
      twinAnchorId: "pin-a",
      originalAnchorId: "moment-center",
      label: "moment center",
    },
    {
      twinAnchorId: "applied-force",
      originalAnchorId: "force-line",
      label: "force and lever arm",
    },
  ],
});
