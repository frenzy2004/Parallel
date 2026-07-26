import { describe, expect, it } from "vitest";
import { createTwinEngineFromEnv } from "@parallel/twin-engine";
import { createApp } from "./app.js";
import { RollingTwinBudget } from "./budget.js";

const createDemoApp = (budget?: RollingTwinBudget) =>
  createApp({
    engine: createTwinEngineFromEnv({ PARALLEL_DEMO_MODE: "1" }),
    ...(budget ? { budget } : {}),
  });

const makeForm = (
  type = "image/png",
  bytes: ArrayBuffer = new TextEncoder().encode("crop").buffer as ArrayBuffer,
): FormData => {
  const form = new FormData();
  form.set("crop", new File([bytes], "crop.png", { type }));
  form.set("coursePackId", "statics-2d-v1");
  return form;
};

describe("local twin API", () => {
  it("rejects unsupported crop MIME types", async () => {
    const response = await createDemoApp().request("/v1/twins", {
      method: "POST",
      body: makeForm("image/svg+xml"),
    });

    expect(response.status).toBe(415);
    expect(await response.json()).toEqual({ error: "unsupported_crop_type" });
  });

  it("rejects crops larger than 8 MB", async () => {
    const response = await createApp().request("/v1/twins", {
      method: "POST",
      body: makeForm("image/png", new ArrayBuffer(8 * 1024 * 1024 + 1)),
    });

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "crop_too_large" });
  });

  it("streams ordered states without an original answer field", async () => {
    const response = await createDemoApp().request("/v1/twins", {
      method: "POST",
      body: makeForm(),
    });
    const body = await response.text();
    const states = body
      .split("\n")
      .filter((line) => line.startsWith("event:"))
      .map((line) => line.slice("event:".length).trim());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(states).toEqual([
      "reading",
      "recognized",
      "twin_step",
      "twin_step",
      "complete",
    ]);
    expect(body).not.toMatch(/original(?:_|)answer/i);
  });

  it("enforces 100 fresh twins but does not charge precedent reopens", async () => {
    const budget = new RollingTwinBudget(1);
    const app = createDemoApp(budget);

    const first = await app.request("/v1/twins", {
      method: "POST",
      body: makeForm(),
    });
    const blocked = await app.request("/v1/twins", {
      method: "POST",
      body: makeForm(),
    });
    const reopenForm = makeForm();
    reopenForm.set("precedentId", "precedent-123");
    const reopened = await app.request("/v1/twins", {
      method: "POST",
      body: reopenForm,
    });

    expect(first.status).toBe(200);
    expect(blocked.status).toBe(429);
    expect(reopened.status).toBe(200);
  });

  it("exposes health, outcomes, abstract matching, and course pack metadata", async () => {
    const app = createApp();
    expect(await (await app.request("/health")).json()).toEqual({
      ok: true,
      mode: "local",
    });

    const outcome = await app.request("/v1/outcomes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: "s1", outcome: "unlocked" }),
    });
    expect(outcome.status).toBe(202);

    const unsafeMatch = await app.request("/v1/precedents/match", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cropDataUrl: "secret" }),
    });
    expect(unsafeMatch.status).toBe(400);

    const coursePack = await app.request("/v1/course-pack/statics-2d-v1");
    expect(coursePack.status).toBe(200);
    expect(await coursePack.json()).toMatchObject({
      id: "statics-2d-v1",
      version: 1,
    });
  });
});
