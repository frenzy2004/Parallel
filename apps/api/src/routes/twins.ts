import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { TwinEngine } from "@parallel/twin-engine";
import { RollingTwinBudget } from "../budget.js";

const MAX_CROP_BYTES = 8 * 1024 * 1024;
const ALLOWED_CROP_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export const createTwinRoutes = (
  engine: TwinEngine,
  budget: RollingTwinBudget,
): Hono => {
  const routes = new Hono();
  routes.post("/", async (context) => {
    const form = await context.req.formData();
    const crop = form.get("crop");
    const coursePackId = form.get("coursePackId");
    const attemptContext = form.get("attemptContext");
    const precedentId = form.get("precedentId");

    if (!(crop instanceof File) || typeof coursePackId !== "string") {
      return context.json({ error: "invalid_request" }, 400);
    }
    if (!ALLOWED_CROP_TYPES.has(crop.type)) {
      return context.json({ error: "unsupported_crop_type" }, 415);
    }
    if (crop.size > MAX_CROP_BYTES) {
      return context.json({ error: "crop_too_large" }, 413);
    }
    if (
      !budget.tryConsume({
        precedentReopen: typeof precedentId === "string" && precedentId.length > 0,
      })
    ) {
      return context.json({ error: "monthly_fresh_twin_budget_exhausted" }, 429);
    }

    const cropBytes = new Uint8Array(await crop.arrayBuffer());
    let cropDataUrl = `data:${crop.type};base64,${Buffer.from(cropBytes).toString("base64")}`;
    return streamSSE(context, async (stream) => {
      try {
        for await (const event of engine.stream({
          cropDataUrl,
          coursePackId,
          ...(typeof attemptContext === "string" && attemptContext.length > 0
            ? { attemptContext }
            : {}),
        })) {
          await stream.writeSSE({
            event: event.state,
            data: JSON.stringify(event),
          });
        }
      } finally {
        cropBytes.fill(0);
        cropDataUrl = "";
      }
    });
  });
  return routes;
};

export { ALLOWED_CROP_TYPES, MAX_CROP_BYTES };
