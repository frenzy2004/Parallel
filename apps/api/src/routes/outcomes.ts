import { Hono } from "hono";
import { z } from "zod";

const OutcomeRequestSchema = z
  .object({
    sessionId: z.string().min(1),
    outcome: z.enum(["unlocked", "wrong_twin", "another_twin", "dismissed"]),
  })
  .strict();

export const createOutcomeRoutes = (): Hono => {
  const routes = new Hono();
  routes.post("/", async (context) => {
    const parsed = OutcomeRequestSchema.safeParse(await context.req.json());
    if (!parsed.success) {
      return context.json({ error: "invalid_outcome" }, 400);
    }
    return context.json({ accepted: true }, 202);
  });
  return routes;
};
