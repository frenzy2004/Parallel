import {
  createPattern,
  derived,
  given,
  selectVariant,
} from "./factory.js";

const variants = [
  {
    scenario: "balcony beam",
    startIntensity: 2,
    endIntensity: 6,
    length: 6,
  },
  {
    scenario: "storage rack",
    startIntensity: 3,
    endIntensity: 7,
    length: 8,
  },
  {
    scenario: "walkway girder",
    startIntensity: 4,
    endIntensity: 8,
    length: 6,
  },
] as const;

export const equivalentDistributedLoad = createPattern({
  id: "equivalent_distributed_load",
  label: "Equivalent distributed load",
  invariants: [
    "resultant equals load-diagram area",
    "line of action passes through the area centroid",
  ],
  allowedMethods: ["rectangle-plus-triangle decomposition", "area centroid"],
  buildCase(seed) {
    const { scenario, startIntensity, endIntensity, length } = selectVariant(
      seed,
      variants,
    );
    const rectangleLoad = startIntensity * length;
    const triangleLoad =
      0.5 * (endIntensity - startIntensity) * length;
    const resultant = rectangleLoad + triangleLoad;
    const rectangleCentroid = length / 2;
    const triangleCentroid = (2 * length) / 3;
    const resultantLocation =
      (rectangleLoad * rectangleCentroid +
        triangleLoad * triangleCentroid) /
      resultant;
    const quantities = [
      given("w_A", startIntensity, "kN/m"),
      given("w_B", endIntensity, "kN/m"),
      given("L", length, "m"),
      derived(
        "R_rect",
        rectangleLoad,
        "kN",
        ["w_A", "L"],
        "area",
      ),
      derived(
        "R_tri",
        triangleLoad,
        "kN",
        ["w_A", "w_B", "L"],
        "area",
      ),
      derived(
        "R",
        resultant,
        "kN",
        ["R_rect", "R_tri"],
        "area",
        true,
      ),
      derived(
        "x_rect",
        rectangleCentroid,
        "m",
        ["L"],
        "centroid",
      ),
      derived(
        "x_tri",
        triangleCentroid,
        "m",
        ["L"],
        "centroid",
      ),
      derived(
        "x_R",
        resultantLocation,
        "m",
        ["R_rect", "R_tri", "x_rect", "x_tri", "R"],
        "centroid",
        true,
      ),
    ] as const;

    return {
      scenario,
      statement:
        `A downward distributed load varies linearly over a ${scenario} from w_A = ${startIntensity} kN/m at end A ` +
        `to w_B = ${endIntensity} kN/m at end B across L = ${length} m. ` +
        "Replace it by a single downward resultant R located x_R from A.",
      unknowns: [
        { symbol: "R", unit: "kN" },
        { symbol: "x_R", unit: "m" },
      ],
      quantities,
      workedSteps: [
        {
          id: "area",
          explanation:
            "Split the trapezoid into a rectangle and a right triangle.",
          expression:
            `R_rect = (${startIntensity} kN/m)(${length} m) = ${rectangleLoad.toFixed(2)} kN; ` +
            `R_tri = (1/2)(${endIntensity} - ${startIntensity}) kN/m (${length} m) = ${triangleLoad.toFixed(2)} kN; ` +
            `R = ${rectangleLoad.toFixed(2)} kN + ${triangleLoad.toFixed(2)} kN = ${resultant.toFixed(2)} kN`,
        },
        {
          id: "centroid",
          explanation:
            "Locate each component centroid, then match the original load moment about A.",
          expression:
            `x_rect = ${length}/2 = ${rectangleCentroid.toFixed(2)} m; ` +
            `x_tri = 2(${length})/3 = ${triangleCentroid.toFixed(2)} m; ` +
            `x_R = [(${rectangleLoad.toFixed(2)})(${rectangleCentroid.toFixed(2)}) + (${triangleLoad.toFixed(2)})(${triangleCentroid.toFixed(2)})] / ${resultant.toFixed(2)} = ${resultantLocation.toFixed(2)} m; ` +
            `R = ${resultant.toFixed(2)} kN; x_R = ${resultantLocation.toFixed(2)} m`,
        },
      ],
    };
  },
  anchors: [
    {
      twinAnchorId: "trapezoidal-load",
      originalAnchorId: "distributed-load",
      label: "distributed load extent and intensity",
    },
    {
      twinAnchorId: "resultant-location",
      originalAnchorId: "load-centroid",
      label: "centroidal line of action",
    },
  ],
});
