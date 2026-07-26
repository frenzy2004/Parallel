import {
  createPattern,
  derived,
  given,
  selectVariant,
} from "./factory.js";

const radians = (degrees: number): number => (degrees * Math.PI) / 180;

const variants = [
  {
    scenario: "sign bracket",
    radius: 2.4,
    positionAngle: 30,
    force: 180,
    forceAngle: 40,
  },
  {
    scenario: "gate handle",
    radius: 1.8,
    positionAngle: 25,
    force: 220,
    forceAngle: 55,
  },
  {
    scenario: "machine lever",
    radius: 3.2,
    positionAngle: 35,
    force: 140,
    forceAngle: 30,
  },
] as const;

export const momentAboutPoint = createPattern({
  id: "moment_about_point",
  label: "Moment about a point",
  invariants: ["M_A = r × F", "counterclockwise moment is positive"],
  allowedMethods: ["Cartesian 2D cross product", "signed scalar moment"],
  buildCase(seed) {
    const { scenario, radius, positionAngle, force, forceAngle } =
      selectVariant(seed, variants);
    const positionX = radius * Math.cos(radians(positionAngle));
    const positionY = radius * Math.sin(radians(positionAngle));
    const forceX = force * Math.cos(radians(forceAngle));
    const forceY = -force * Math.sin(radians(forceAngle));
    const moment = positionX * forceY - positionY * forceX;
    const quantities = [
      given("r", radius, "m"),
      given("φ", positionAngle, "°"),
      given("F", force, "N"),
      given("θ", forceAngle, "°"),
      derived("r_x", positionX, "m", ["r", "φ"], "lever-arm"),
      derived("r_y", positionY, "m", ["r", "φ"], "lever-arm"),
      derived("F_x", forceX, "N", ["F", "θ"], "lever-arm"),
      derived("F_y", forceY, "N", ["F", "θ"], "lever-arm"),
      derived(
        "M_A",
        moment,
        "N·m",
        ["r_x", "r_y", "F_x", "F_y"],
        "moment",
        true,
      ),
    ] as const;

    return {
      scenario,
      statement:
        `Point B on a ${scenario} is r = ${radius} m from pin A at φ = ${positionAngle}° above +x. ` +
        `At B, a force F = ${force} N acts θ = ${forceAngle}° below +x. ` +
        "Taking counterclockwise as positive, determine the signed moment M_A.",
      unknowns: [{ symbol: "M_A", unit: "N·m" }],
      quantities,
      workedSteps: [
        {
          id: "lever-arm",
          explanation:
            "Resolve both the position vector and the applied force into signed Cartesian components.",
          expression:
            `r_x = ${radius} cos ${positionAngle}° = ${positionX.toFixed(2)} m; ` +
            `r_y = ${radius} sin ${positionAngle}° = ${positionY.toFixed(2)} m; ` +
            `F_x = ${force} cos ${forceAngle}° = ${forceX.toFixed(2)} N; ` +
            `F_y = -${force} sin ${forceAngle}° = ${forceY.toFixed(2)} N`,
        },
        {
          id: "moment",
          explanation:
            "Evaluate the z component of r × F using the equivalent included-angle substitution; the negative sign means clockwise.",
          expression:
            `M_A = r_x F_y - r_y F_x = -rF sin(φ + θ) = -(${radius})(${force}) sin(${positionAngle}° + ${forceAngle}°) = ${moment.toFixed(2)} N·m; ` +
            `M_A = ${moment.toFixed(2)} N·m`,
        },
      ],
    };
  },
  anchors: [
    {
      twinAnchorId: "pin-a",
      originalAnchorId: "moment-center",
      label: "moment center",
    },
    {
      twinAnchorId: "position-vector",
      originalAnchorId: "force-application-point",
      label: "position to applied force",
    },
    {
      twinAnchorId: "applied-force",
      originalAnchorId: "force-line",
      label: "force direction",
    },
  ],
});
