import { createPattern } from "./factory.js";

export const resultantCoplanarForces = createPattern({
  id: "resultant_coplanar_forces",
  label: "Resultant of coplanar forces",
  invariants: ["vector components sum independently", "R = ΣF"],
  numericBounds: {
    forceN: { min: 30, max: 220 },
    distanceM: { min: 1, max: 5 },
    angleDeg: { min: 15, max: 75 },
  },
  allowedMethods: ["Cartesian components", "resultant magnitude and direction"],
  scenarios: ["tow hook", "gantry lug", "dock cleat"],
  statement: (_seed, scenario, force) =>
    `Two planar pulls act on a ${scenario}; one has magnitude ${force} N. Resolve the pulls and determine their single resultant.`,
  steps: (_seed, force) => [
    {
      id: "components",
      explanation: "Resolve each pull into Cartesian components.",
      expression: `F₁ = ⟨F₁cosθ₁, F₁sinθ₁⟩; F₂ = ⟨${force}cosθ₂, ${force}sinθ₂⟩`,
    },
    {
      id: "resultant",
      explanation: "Sum components before computing magnitude and direction.",
      expression: "R = ⟨ΣFx, ΣFy⟩; |R| = √(Rx² + Ry²)",
    },
  ],
  anchors: [
    {
      twinAnchorId: "resultant-vector",
      originalAnchorId: "force-system",
      label: "equivalent resultant",
    },
  ],
});
