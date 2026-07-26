import { describe, expect, it } from "vitest";
import { maxDuration, POST, runtime } from "./route";

describe("demo route deployment boundary", () => {
  it("serves only the fixed fixture from the Node runtime", async () => {
    const response = await POST(
      new Request("http://parallel.test/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fixtureId: "moment-about-point-v1" }),
      }),
    );
    const body = await response.json();

    expect(runtime).toBe("nodejs");
    expect(maxDuration).toBe(60);
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      fixedDemo: true,
      analyzedUpload: false,
      fixtureId: "moment-about-point-v1",
    });
    expect(body.events.at(-1)).toMatchObject({ state: "complete" });
  });
});
