import { createPattern } from "./factory.js";

export const equivalentDistributedLoad = createPattern({
  id: "equivalent_distributed_load",
  label: "Equivalent distributed load",
  invariants: ["resultant equals load-diagram area", "line of action passes through centroid"],
  numericBounds: {
    forceN: { min: 20, max: 100 },
    distanceM: { min: 2, max: 8 },
    angleDeg: { min: 0, max: 0 },
  },
  allowedMethods: ["area-centroid reduction", "equivalent point load"],
  scenarios: ["balcony beam", "storage rack", "walkway girder"],
  statement: (_seed, scenario, force, distance) =>
    `A uniform load of ${force} N/m acts across ${distance} m of a ${scenario}. Replace it with one statically equivalent point load.`,
  steps: (_seed, force, distance) => [
    {
      id: "area",
      explanation: "The resultant is the area beneath the rectangular load diagram.",
      expression: `R = wL = (${force})(${distance}) N`,
    },
    {
      id: "centroid",
      explanation: "Place the resultant at the rectangle centroid.",
      expression: `x̄ = L/2 = ${distance / 2} m from the loaded edge`,
    },
  ],
  anchors: [
    {
      twinAnchorId: "load-diagram",
      originalAnchorId: "distributed-load",
      label: "distributed load extent",
    },
    {
      twinAnchorId: "resultant-location",
      originalAnchorId: "load-centroid",
      label: "centroidal line of action",
    },
  ],
});
