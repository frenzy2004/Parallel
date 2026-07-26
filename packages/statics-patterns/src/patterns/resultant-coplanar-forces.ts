import {
  createPattern,
  derived,
  given,
  selectVariant,
} from "./factory.js";

const radians = (degrees: number): number => (degrees * Math.PI) / 180;
const degrees = (radiansValue: number): number =>
  (radiansValue * 180) / Math.PI;

const variants = [
  {
    scenario: "tow hook",
    firstForce: 400,
    firstAngle: 30,
    secondForce: 250,
    secondAngle: 40,
  },
  {
    scenario: "gantry lug",
    firstForce: 520,
    firstAngle: 25,
    secondForce: 310,
    secondAngle: 55,
  },
  {
    scenario: "dock cleat",
    firstForce: 460,
    firstAngle: 42,
    secondForce: 280,
    secondAngle: 32,
  },
] as const;

export const resultantCoplanarForces = createPattern({
  id: "resultant_coplanar_forces",
  label: "Resultant of coplanar forces",
  invariants: ["vector components sum independently", "R = ΣF"],
  allowedMethods: ["Cartesian components", "resultant magnitude and direction"],
  buildCase(seed) {
    const {
      scenario,
      firstForce,
      firstAngle,
      secondForce,
      secondAngle,
    } = selectVariant(seed, variants);
    const firstX = firstForce * Math.cos(radians(firstAngle));
    const firstY = firstForce * Math.sin(radians(firstAngle));
    const secondX = -secondForce * Math.cos(radians(secondAngle));
    const secondY = secondForce * Math.sin(radians(secondAngle));
    const resultantX = firstX + secondX;
    const resultantY = firstY + secondY;
    const resultant = Math.hypot(resultantX, resultantY);
    const resultantAngle = degrees(Math.atan2(resultantY, resultantX));
    const quantities = [
      given("F_A", firstForce, "N"),
      given("θ_A", firstAngle, "°"),
      given("F_B", secondForce, "N"),
      given("β_B", secondAngle, "°"),
      derived("F_Ax", firstX, "N", ["F_A", "θ_A"], "components"),
      derived("F_Ay", firstY, "N", ["F_A", "θ_A"], "components"),
      derived("F_Bx", secondX, "N", ["F_B", "β_B"], "components"),
      derived("F_By", secondY, "N", ["F_B", "β_B"], "components"),
      derived("R_x", resultantX, "N", ["F_Ax", "F_Bx"], "sum-components"),
      derived("R_y", resultantY, "N", ["F_Ay", "F_By"], "sum-components"),
      derived(
        "R",
        resultant,
        "N",
        ["R_x", "R_y"],
        "resultant",
        true,
      ),
      derived(
        "θ_R",
        resultantAngle,
        "°",
        ["R_x", "R_y"],
        "resultant",
        true,
      ),
    ] as const;

    return {
      scenario,
      statement:
        `Two pulls act on a ${scenario}. F_A = ${firstForce} N is directed θ_A = ${firstAngle}° above +x. ` +
        `F_B = ${secondForce} N is directed β_B = ${secondAngle}° above the −x axis. ` +
        "Determine the resultant magnitude R and direction θ_R counterclockwise from +x.",
      unknowns: [
        { symbol: "R", unit: "N" },
        { symbol: "θ_R", unit: "°" },
      ],
      quantities,
      workedSteps: [
        {
          id: "components",
          explanation: "Resolve both pulls into signed Cartesian components.",
          expression:
            `F_Ax = ${firstForce} cos ${firstAngle}° = ${firstX.toFixed(2)} N; ` +
            `F_Ay = ${firstForce} sin ${firstAngle}° = ${firstY.toFixed(2)} N; ` +
            `F_Bx = -${secondForce} cos ${secondAngle}° = ${secondX.toFixed(2)} N; ` +
            `F_By = ${secondForce} sin ${secondAngle}° = ${secondY.toFixed(2)} N`,
        },
        {
          id: "sum-components",
          explanation: "Add corresponding components before taking a magnitude.",
          expression:
            `R_x = ${firstX.toFixed(2)} N + (${secondX.toFixed(2)} N) = ${resultantX.toFixed(2)} N; ` +
            `R_y = ${firstY.toFixed(2)} N + ${secondY.toFixed(2)} N = ${resultantY.toFixed(2)} N`,
        },
        {
          id: "resultant",
          explanation:
            "Use the component vector to compute the resultant magnitude and quadrant-correct direction.",
          expression:
            `R = √((${resultantX.toFixed(2)})² + (${resultantY.toFixed(2)})²) = ${resultant.toFixed(2)} N; ` +
            `θ_R = atan2(${resultantY.toFixed(2)}, ${resultantX.toFixed(2)}) = ${resultantAngle.toFixed(2)}°; ` +
            `R = ${resultant.toFixed(2)} N; θ_R = ${resultantAngle.toFixed(2)}°`,
        },
      ],
    };
  },
  anchors: [
    {
      twinAnchorId: "component-system",
      originalAnchorId: "force-directions",
      label: "signed force components",
    },
    {
      twinAnchorId: "resultant-vector",
      originalAnchorId: "force-system",
      label: "equivalent resultant",
    },
  ],
});
