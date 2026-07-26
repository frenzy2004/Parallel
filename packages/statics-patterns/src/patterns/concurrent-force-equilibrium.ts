import {
  createPattern,
  derived,
  given,
  selectVariant,
} from "./factory.js";

const radians = (degrees: number): number => (degrees * Math.PI) / 180;

const variants = [
  {
    scenario: "mooring ring",
    load: 600,
    leftAngle: 30,
    rightAngle: 45,
  },
  {
    scenario: "ceiling eyelet",
    load: 720,
    leftAngle: 35,
    rightAngle: 50,
  },
  {
    scenario: "rescue-line junction",
    load: 840,
    leftAngle: 40,
    rightAngle: 55,
  },
] as const;

export const concurrentForceEquilibrium = createPattern({
  id: "concurrent_force_equilibrium",
  label: "Concurrent-force equilibrium",
  invariants: ["all force lines of action intersect", "ΣFx = 0", "ΣFy = 0"],
  allowedMethods: ["particle free-body diagram", "component equilibrium"],
  buildCase(seed) {
    const { scenario, load, leftAngle, rightAngle } = selectVariant(
      seed,
      variants,
    );
    const denominator = Math.sin(radians(leftAngle + rightAngle));
    const leftTension =
      (load * Math.cos(radians(rightAngle))) / denominator;
    const rightTension =
      (load * Math.cos(radians(leftAngle))) / denominator;
    const quantities = [
      given("W", load, "N"),
      given("α", leftAngle, "°"),
      given("β", rightAngle, "°"),
      derived(
        "T_L",
        leftTension,
        "N",
        ["W", "α", "β"],
        "equilibrium",
        true,
      ),
      derived(
        "T_R",
        rightTension,
        "N",
        ["W", "α", "β"],
        "equilibrium",
        true,
      ),
    ] as const;

    return {
      scenario,
      statement:
        `A ${scenario} carries a downward load W = ${load} N at a common pin. ` +
        `The left cable rises α = ${leftAngle}° above the leftward horizontal, ` +
        `and the right cable rises β = ${rightAngle}° above the rightward horizontal. ` +
        "Determine the cable magnitudes T_L and T_R.",
      unknowns: [
        { symbol: "T_L", unit: "N" },
        { symbol: "T_R", unit: "N" },
      ],
      quantities,
      workedSteps: [
        {
          id: "fbd",
          explanation:
            "Resolve the two cable tensions at the pin and write both equilibrium equations.",
          expression:
            `ΣF_x = -T_L cos ${leftAngle}° + T_R cos ${rightAngle}° = 0; ` +
            `ΣF_y = T_L sin ${leftAngle}° + T_R sin ${rightAngle}° - ${load} N = 0`,
        },
        {
          id: "equilibrium",
          explanation:
            "Solve the simultaneous component equations using the stated cable angles.",
          expression:
            `T_L = ${load} cos ${rightAngle}° / sin(${leftAngle}° + ${rightAngle}°) = ${leftTension.toFixed(2)} N; ` +
            `T_R = ${load} cos ${leftAngle}° / sin(${leftAngle}° + ${rightAngle}°) = ${rightTension.toFixed(2)} N; ` +
            `T_L = ${leftTension.toFixed(2)} N; T_R = ${rightTension.toFixed(2)} N`,
        },
      ],
    };
  },
  anchors: [
    {
      twinAnchorId: "common-pin",
      originalAnchorId: "force-intersection",
      label: "concurrent point",
    },
    {
      twinAnchorId: "cable-directions",
      originalAnchorId: "force-directions",
      label: "known cable angles",
    },
  ],
});
