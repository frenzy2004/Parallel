import { afterEach, describe, expect, it, vi } from "vitest";
import { maxDuration, POST, runtime } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("twins route deployment boundary", () => {
  it("runs server-side and preserves the live-provider fail-closed response", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const form = new FormData();
    form.append(
      "crop",
      new File([Uint8Array.from([137, 80, 78, 71])], "problem.png", {
        type: "image/png",
      }),
    );
    form.append("coursePackId", "statics-101");

    const response = await POST(
      new Request("http://parallel.test/api/twins", {
        method: "POST",
        body: form,
      }),
    );

    expect(runtime).toBe("nodejs");
    expect(maxDuration).toBe(60);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: { code: "live_recognition_unavailable" },
    });
  });
});
