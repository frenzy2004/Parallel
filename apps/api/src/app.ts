import { Hono } from "hono";
import { createTwinEngineFromEnv, type TwinEngine } from "@parallel/twin-engine";
import { RollingTwinBudget } from "./budget.js";
import { createCoursePackRoutes } from "./routes/course-packs.js";
import { createOutcomeRoutes } from "./routes/outcomes.js";
import { createPrecedentRoutes } from "./routes/precedents.js";
import { createTwinRoutes } from "./routes/twins.js";

interface AppOptions {
  engine?: TwinEngine;
  budget?: RollingTwinBudget;
}

export const createApp = (options: AppOptions = {}): Hono => {
  const app = new Hono();
  const engine = options.engine ?? createTwinEngineFromEnv({});
  const budget = options.budget ?? new RollingTwinBudget();

  app.get("/health", (context) => context.json({ ok: true, mode: "local" }));
  app.route("/v1/twins", createTwinRoutes(engine, budget));
  app.route("/v1/outcomes", createOutcomeRoutes());
  app.route("/v1/precedents", createPrecedentRoutes());
  app.route("/v1/course-pack", createCoursePackRoutes());
  return app;
};

export type { AppOptions };
