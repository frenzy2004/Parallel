import { Hono } from "hono";

const STATICS_COURSE_PACK = {
  id: "statics-2d-v1",
  version: 1,
  domain: "statics_2d",
  convention: "counter-clockwise moments are positive",
  methods: [
    "Cartesian force components",
    "scalar 2D moments",
    "2D equilibrium equations",
    "area-centroid load reduction",
  ],
} as const;

export const createCoursePackRoutes = (): Hono => {
  const routes = new Hono();
  routes.get("/:id", (context) => {
    if (context.req.param("id") !== STATICS_COURSE_PACK.id) {
      return context.json({ error: "course_pack_not_found" }, 404);
    }
    return context.json(STATICS_COURSE_PACK);
  });
  return routes;
};

export { STATICS_COURSE_PACK };
