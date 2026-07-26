import { createPattern } from "./factory.js";

export const rigidBodyEquilibrium2d = createPattern({
  id: "rigid_body_equilibrium_2d",
  label: "2D rigid-body equilibrium",
  invariants: ["ΣFx = 0", "ΣFy = 0", "ΣM = 0"],
  numericBounds: {
    forceN: { min: 60, max: 300 },
    distanceM: { min: 1, max: 8 },
    angleDeg: { min: 15, max: 75 },
  },
  allowedMethods: ["rigid-body free-body diagram", "three equilibrium equations"],
  scenarios: ["awning beam", "loading-ramp frame", "equipment shelf"],
  statement: (_seed, scenario, force, distance) =>
    `A ${distance} m ${scenario} carries a ${force} N load and is supported by a pin and a cable. Determine the support reactions.`,
  steps: (_seed, force, distance) => [
    {
      id: "fbd",
      explanation: "Replace the pin and cable by their reaction components.",
      expression: `unknowns: Aₓ, Aᵧ, T; load = ${force} N`,
    },
    {
      id: "moment-equilibrium",
      explanation: "Take moments about the pin to eliminate its reactions.",
      expression: `ΣM_A = T_y(${distance}) - ${force}(${distance / 2}) = 0`,
    },
    {
      id: "force-equilibrium",
      explanation: "Use force equilibrium for the remaining reactions.",
      expression: "ΣFx = 0; ΣFy = 0",
    },
  ],
  anchors: [
    {
      twinAnchorId: "pin-support",
      originalAnchorId: "pin-support",
      label: "two-component support",
    },
    {
      twinAnchorId: "cable",
      originalAnchorId: "tension-member",
      label: "single-line reaction",
    },
  ],
});
