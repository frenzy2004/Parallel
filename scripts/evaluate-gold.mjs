import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import {
  StructuralSignatureSchema,
  TwinRenderSchema,
} from "@parallel/contracts";
import { compileVerifiedTwin } from "@parallel/statics-patterns";

const cases = JSON.parse(
  await readFile(
    new URL("../tests/evals/statics-gold.json", import.meta.url),
    "utf8",
  ),
);

if (!Array.isArray(cases) || cases.length !== 100) {
  console.error("Synthetic preflight failed: expected exactly 100 cases.");
  process.exit(1);
}

const results = cases.map((goldCase) => {
  const signature = StructuralSignatureSchema.parse({
    domain: "statics_2d",
    patternId: goldCase.expectedPattern,
    entities: ["force system", "reference geometry"],
    relationships: ["the pattern invariant relates the declared entities"],
    constraints: ["counter-clockwise positive"],
    goal: "solve the pattern-specific unknown",
    invariant: `validated ${goldCase.expectedPattern} invariant`,
    courseConvention: "counter-clockwise positive",
    missingContext: [],
    confidence: 0.98,
    exaQuery: `introductory 2D statics worked example ${goldCase.expectedPattern}`,
  });
  const startedAt = performance.now();
  const twin = compileVerifiedTwin(signature, goldCase.seed);
  const latencyMs = performance.now() - startedAt;
  const schemaValid = TwinRenderSchema.safeParse(twin).success;
  const structurallyFaithful =
    twin.patternId === signature.patternId &&
    twin.confidence >= 0.8 &&
    twin.rejectionReason === null;
  return {
    schemaValid,
    structurallyFaithful,
    confidentlyWrong: twin.confidence >= 0.8 && !structurallyFaithful,
    answerLeakage:
      twin.answerLeak !== false ||
      /original(?:_|)answer/i.test(JSON.stringify(twin)),
    latencyMs,
  };
});

const count = (key) => results.filter((result) => result[key]).length;
const sortedLatency = results.map((result) => result.latencyMs).sort((a, b) => a - b);
const medianLatencyMs = sortedLatency[Math.floor(sortedLatency.length / 2)];
const report = {
  label: "synthetic_preflight_not_live_model_validation",
  cases: results.length,
  schemaValidityPercent: count("schemaValid"),
  structuralPatternFidelityPercent: count("structurallyFaithful"),
  confidentlyWrongPercent: count("confidentlyWrong"),
  answerLeakagePercent: count("answerLeakage"),
  deterministicCompilerMedianMs: Number(medianLatencyMs.toFixed(3)),
  note: "TA review and the GTM protocol remain responsible for live-model and course-method validation.",
};

console.log(JSON.stringify(report, null, 2));

if (
  report.schemaValidityPercent !== 100 ||
  report.structuralPatternFidelityPercent !== 100 ||
  report.confidentlyWrongPercent !== 0 ||
  report.answerLeakagePercent !== 0
) {
  process.exit(1);
}
