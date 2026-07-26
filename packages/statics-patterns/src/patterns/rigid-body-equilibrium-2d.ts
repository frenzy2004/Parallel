import {
  createPattern,
  derived,
  given,
  selectVariant,
} from "./factory.js";

const variants = [
  {
    scenario: "awning beam",
    length: 4,
    anchorHeight: 3,
    loadPosition: 2,
    load: 600,
  },
  {
    scenario: "loading-ramp frame",
    length: 6,
    anchorHeight: 8,
    loadPosition: 3,
    load: 800,
  },
  {
    scenario: "equipment shelf",
    length: 8,
    anchorHeight: 6,
    loadPosition: 6,
    load: 900,
  },
] as const;

export const rigidBodyEquilibrium2d = createPattern({
  id: "rigid_body_equilibrium_2d",
  label: "2D rigid-body equilibrium",
  invariants: ["ΣFx = 0", "ΣFy = 0", "ΣM_A = 0"],
  allowedMethods: [
    "rigid-body free-body diagram",
    "cable unit vector",
    "three equilibrium equations",
  ],
  buildCase(seed) {
    const { scenario, length, anchorHeight, loadPosition, load } =
      selectVariant(seed, variants);
    const cableLength = Math.hypot(length, anchorHeight);
    const sinAlpha = anchorHeight / cableLength;
    const cosAlpha = length / cableLength;
    const verticalTension = (load * loadPosition) / length;
    const tension = verticalTension / sinAlpha;
    const horizontalTension = -tension * cosAlpha;
    const reactionX = -horizontalTension;
    const reactionY = load - verticalTension;
    const quantities = [
      given("L", length, "m"),
      given("h", anchorHeight, "m"),
      given("a", loadPosition, "m"),
      given("W", load, "N"),
      derived("s", cableLength, "m", ["L", "h"], "fbd"),
      derived("sinα", sinAlpha, "ratio", ["h", "s"], "fbd"),
      derived("cosα", cosAlpha, "ratio", ["L", "s"], "fbd"),
      derived(
        "T_y",
        verticalTension,
        "N",
        ["W", "a", "L"],
        "moment-equilibrium",
      ),
      derived("T", tension, "N", ["T_y", "sinα"], "cable-force", true),
      derived(
        "T_x",
        horizontalTension,
        "N",
        ["T", "cosα"],
        "cable-force",
      ),
      derived(
        "A_x",
        reactionX,
        "N",
        ["T_x"],
        "force-equilibrium",
        true,
      ),
      derived(
        "A_y",
        reactionY,
        "N",
        ["W", "T_y"],
        "force-equilibrium",
        true,
      ),
    ] as const;

    return {
      scenario,
      statement:
        `A horizontal ${scenario} AB has length L = ${length} m and is pinned at A. ` +
        `A cable runs from B to wall anchor C located h = ${anchorHeight} m directly above A. ` +
        `A downward load W = ${load} N acts a = ${loadPosition} m from A. ` +
        "Determine cable tension T and pin reactions A_x and A_y.",
      unknowns: [
        { symbol: "T", unit: "N" },
        { symbol: "A_x", unit: "N" },
        { symbol: "A_y", unit: "N" },
      ],
      quantities,
      workedSteps: [
        {
          id: "fbd",
          explanation:
            "Use the stated support coordinates to obtain the cable direction ratios.",
          expression:
            `s = √(${length}² + ${anchorHeight}²) = ${cableLength.toFixed(2)} m; ` +
            `sinα = ${anchorHeight}/${cableLength.toFixed(2)} = ${sinAlpha.toFixed(2)}; ` +
            `cosα = ${length}/${cableLength.toFixed(2)} = ${cosAlpha.toFixed(2)}`,
        },
        {
          id: "moment-equilibrium",
          explanation:
            "Take moments about A to eliminate both pin-reaction components.",
          expression:
            `ΣM_A = T_y(${length} m) - (${load} N)(${loadPosition} m) = 0; ` +
            `T_y = (${load})(${loadPosition})/${length} = ${verticalTension.toFixed(2)} N`,
        },
        {
          id: "cable-force",
          explanation:
            "Recover the cable magnitude and its leftward horizontal component.",
          expression:
            `T = T_y/sinα = ${verticalTension.toFixed(2)}/${sinAlpha.toFixed(2)} = ${tension.toFixed(2)} N; ` +
            `T_x = -T cosα = -(${tension.toFixed(2)})(${cosAlpha.toFixed(2)}) = ${horizontalTension.toFixed(2)} N`,
        },
        {
          id: "force-equilibrium",
          explanation:
            "Apply horizontal and vertical force equilibrium, then report every requested reaction.",
          expression:
            `A_x = -T_x = ${reactionX.toFixed(2)} N; ` +
            `A_y = ${load} N - ${verticalTension.toFixed(2)} N = ${reactionY.toFixed(2)} N; ` +
            `T = ${tension.toFixed(2)} N; A_x = ${reactionX.toFixed(2)} N; A_y = ${reactionY.toFixed(2)} N`,
        },
      ],
    };
  },
  anchors: [
    {
      twinAnchorId: "pin-support",
      originalAnchorId: "pin-support",
      label: "two-component support",
    },
    {
      twinAnchorId: "cable-geometry",
      originalAnchorId: "tension-member",
      label: "single-line cable reaction",
    },
    {
      twinAnchorId: "applied-load",
      originalAnchorId: "applied-load",
      label: "load and moment arm",
    },
  ],
});
