import {
  createPattern,
  derived,
  given,
  selectVariant,
} from "./factory.js";

const variants = [
  {
    scenario: "valve wheel",
    force: 120,
    separation: 0.8,
    direction: "counterclockwise",
    sign: 1,
  },
  {
    scenario: "steering yoke",
    force: 180,
    separation: 0.6,
    direction: "clockwise",
    sign: -1,
  },
  {
    scenario: "fixture plate",
    force: 95,
    separation: 1.2,
    direction: "counterclockwise",
    sign: 1,
  },
] as const;

export const coupleMoments = createPattern({
  id: "couple_moments",
  label: "Couple moments",
  invariants: ["equal opposite forces", "free-vector moment M_c = Fd"],
  allowedMethods: ["couple reduction", "signed algebraic sum"],
  buildCase(seed) {
    const { scenario, force, separation, direction, sign } = selectVariant(
      seed,
      variants,
    );
    const moment = sign * force * separation;
    const quantities = [
      given("F", force, "N"),
      given("d", separation, "m"),
      derived("M_c", moment, "N·m", ["F", "d"], "moment", true),
    ] as const;

    return {
      scenario,
      statement:
        `Two parallel forces of magnitude F = ${force} N act in opposite directions on a ${scenario}. ` +
        `Their perpendicular separation is d = ${separation} m, and the pair tends to rotate the body ${direction}. ` +
        "Taking counterclockwise as positive, determine the equivalent couple M_c.",
      unknowns: [{ symbol: "M_c", unit: "N·m" }],
      quantities,
      workedSteps: [
        {
          id: "couple",
          explanation:
            "Equal opposite forces cancel as a force but remain separated in space.",
          expression: `F_net = ${force} N - ${force} N = 0 N`,
        },
        {
          id: "moment",
          explanation:
            `Multiply either force by the perpendicular separation and apply the ${direction} sign.`,
          expression:
            `M_c = ${sign < 0 ? "-" : ""}Fd = ${sign < 0 ? "-" : ""}(${force} N)(${separation} m) = ${moment.toFixed(2)} N·m; ` +
            `M_c = ${moment.toFixed(2)} N·m`,
        },
      ],
    };
  },
  anchors: [
    {
      twinAnchorId: "force-pair",
      originalAnchorId: "opposite-force-pair",
      label: "equal opposite force pair",
    },
    {
      twinAnchorId: "perpendicular-gap",
      originalAnchorId: "couple-arm",
      label: "perpendicular separation",
    },
  ],
});
