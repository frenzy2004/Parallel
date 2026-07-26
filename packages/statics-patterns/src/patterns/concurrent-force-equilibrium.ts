import { createPattern } from "./factory.js";

export const concurrentForceEquilibrium = createPattern({
  id: "concurrent_force_equilibrium",
  label: "Concurrent-force equilibrium",
  invariants: ["all force lines of action intersect", "ΣFx = 0", "ΣFy = 0"],
  numericBounds: {
    forceN: { min: 40, max: 180 },
    distanceM: { min: 1, max: 4 },
    angleDeg: { min: 20, max: 70 },
  },
  allowedMethods: ["particle free-body diagram", "component equilibrium"],
  scenarios: ["mooring ring", "ceiling eyelet", "rescue-line junction"],
  statement: (_seed, scenario, force) =>
    `A ${scenario} is held by two cables while a ${force} N vertical load acts at their common pin. Determine the two cable tensions.`,
  steps: (_seed, force) => [
    {
      id: "fbd",
      explanation: "Isolate the common pin and resolve every concurrent force.",
      expression: `F_y = -${force} N`,
    },
    {
      id: "equilibrium",
      explanation: "Apply the two independent particle-equilibrium equations.",
      expression: "ΣFx = 0; ΣFy = 0",
    },
  ],
  anchors: [
    {
      twinAnchorId: "common-pin",
      originalAnchorId: "force-intersection",
      label: "concurrent point",
    },
  ],
});
