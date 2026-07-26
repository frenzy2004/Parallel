import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { createTwinEngineFromEnv } from "@parallel/twin-engine";

function safeFailureReason(message) {
  const exaStatus = message.match(/Exa search failed with (\d{3})/i)?.[1];
  if (exaStatus) return `exa_http_${exaStatus}`;
  if (/invalid schema|response[_ ]format|structured output/i.test(message)) {
    return "openai_structured_output_schema";
  }
  if (/model.+(?:not found|does not exist|access)/i.test(message)) {
    return "openai_model_unavailable";
  }
  if (/\b401\b|authentication|invalid api key/i.test(message)) {
    return "provider_authentication";
  }
  if (/\b429\b|rate.?limit|quota/i.test(message)) {
    return "provider_rate_limit";
  }
  if (/structural safety gate/i.test(message)) {
    return "twin_safety_gate";
  }
  return "provider_pipeline_error";
}

if (!process.env.OPENAI_API_KEY || !process.env.EXA_API_KEY) {
  console.error("status=skipped reason=missing_OPENAI_API_KEY_or_EXA_API_KEY");
  process.exit(2);
}

const directory = mkdtempSync(join(tmpdir(), "parallel-live-smoke-"));
const imagePath = join(directory, "statics-fixture.png");
try {
  console.log("status=rendering_fixture");
  const electronPath = resolve("apps/desktop/node_modules/.bin/electron");
  const render = spawnSync(
    electronPath,
    [resolve("scripts/capture-fixture.cjs"), imagePath],
    { stdio: "ignore", timeout: 30_000 },
  );
  if (render.status !== 0) {
    console.error("status=failed stage=fixture_render");
    process.exit(1);
  }

  const cropDataUrl = `data:image/png;base64,${readFileSync(imagePath).toString("base64")}`;
  const startedAt = performance.now();
  let pattern = "unknown";
  let complete = false;
  for await (const event of createTwinEngineFromEnv(process.env).stream({
    cropDataUrl,
    coursePackId: "statics-2d-v1",
  })) {
    if (event.state === "recognized") {
      pattern = event.signature.patternId;
      console.log(
        `status=recognized pattern=${pattern} latency_ms=${Math.round(performance.now() - startedAt)}`,
      );
    }
    if (event.state === "complete") {
      complete = true;
      console.log(
        `status=complete pattern=${event.twin.patternId} latency_ms=${Math.round(performance.now() - startedAt)}`,
      );
    }
    if (["recapture", "unsupported", "error"].includes(event.state)) {
      const reason =
        event.state === "error"
          ? safeFailureReason(event.message)
          : event.state;
      console.error(
        `status=failed stage=${event.state} reason=${reason} pattern=${pattern} latency_ms=${Math.round(performance.now() - startedAt)}`,
      );
      process.exitCode = 1;
    }
  }
  if (!complete) process.exitCode = 1;
} finally {
  rmSync(directory, { recursive: true, force: true });
}
