import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { TwinEvent } from "@parallel/contracts/events";
import { createTwinEngineFromEnv } from "@parallel/twin-engine";

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
    for await (const event of createTwinEngineFromEnv({}).stream({
      cropDataUrl: "data:image/png;base64,ZGVtby1jcm9w",
      coursePackId: "statics-2d-v1",
    })) {
      events.push(event);
    }
    expect(events.at(-1)?.state).toBe("complete");
    expect(JSON.stringify(events)).not.toMatch(/original(?:_|)answer/i);
  });
});
