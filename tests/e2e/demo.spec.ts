import { execFile } from "node:child_process";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import type { TwinEvent } from "@parallel/contracts/events";
import { createTwinEngineFromEnv } from "@parallel/twin-engine";

const execFileAsync = promisify(execFile);

describe("bundled no-key demo journey", () => {
  it("ships a complete lasso target and deterministic worked twin", async () => {
    const fixtureUrl = new URL(
      "../../apps/desktop/demo/statics-problem.html",
      import.meta.url,
    );
    const fixture = await readFile(fixtureUrl, "utf8");
    expect(fixture).toContain("Determine the moment");
    expect(fixture).toContain("Point A");
    expect(fixture).not.toContain("OPENAI_API_KEY");

    const events: TwinEvent[] = [];
    for await (const event of createTwinEngineFromEnv({
      PARALLEL_DEMO_MODE: "1",
    }).stream({
      cropDataUrl: "data:image/png;base64,ZGVtby1jcm9w",
      coursePackId: "statics-2d-v1",
    })) {
      events.push(event);
    }
    expect(events.at(-1)?.state).toBe("complete");
    expect(JSON.stringify(events)).not.toMatch(/original(?:_|)answer/i);
  });

  it.runIf(process.platform === "darwin")(
    "scrubs inherited live credentials and model overrides before Electron starts",
    async () => {
      const sandbox = await mkdtemp(join(tmpdir(), "parallel-demo-env-"));
      const fakeBin = join(sandbox, "bin");
      const electronBin = join(
        sandbox,
        "apps",
        "desktop",
        "node_modules",
        ".bin",
      );
      const envOutput = join(sandbox, "electron-env.txt");
      await mkdir(fakeBin, { recursive: true });
      await mkdir(electronBin, { recursive: true });
      await writeFile(join(fakeBin, "open"), "#!/bin/sh\nexit 0\n");
      await writeFile(
        join(electronBin, "electron"),
        "#!/bin/sh\nenv > \"$PARALLEL_TEST_ENV_OUTPUT\"\n",
      );
      await chmod(join(fakeBin, "open"), 0o755);
      await chmod(join(electronBin, "electron"), 0o755);

      const script = new URL("../../scripts/run-demo.mjs", import.meta.url);
      await execFileAsync(process.execPath, [script.pathname], {
        cwd: sandbox,
        env: {
          ...process.env,
          PATH: `${fakeBin}:${process.env.PATH ?? ""}`,
          PARALLEL_TEST_ENV_OUTPUT: envOutput,
          OPENAI_API_KEY: "inherited-openai-key",
          EXA_API_KEY: "inherited-exa-key",
          OPENAI_RECOGNITION_MODEL: "inherited-live-model",
        },
      });
      const childEnvironment = new Map(
        (await readFile(envOutput, "utf8"))
          .trim()
          .split("\n")
          .map((line) => {
            const separator = line.indexOf("=");
            return [line.slice(0, separator), line.slice(separator + 1)];
          }),
      );

      expect(childEnvironment.get("PARALLEL_DEMO_MODE")).toBe("1");
      expect(childEnvironment.has("OPENAI_API_KEY")).toBe(false);
      expect(childEnvironment.has("EXA_API_KEY")).toBe(false);
      expect(childEnvironment.has("OPENAI_RECOGNITION_MODEL")).toBe(false);
    },
  );
});
