import { Hono } from "hono";
import { StructuralSignatureSchema } from "@parallel/contracts";

export const createPrecedentRoutes = (): Hono => {
  const routes = new Hono();
  routes.post("/match", async (context) => {
    const body = (await context.req.json()) as unknown;
    const signature =
      typeof body === "object" && body !== null && "signature" in body
        ? (body as { signature: unknown }).signature
        : undefined;
    const parsed = StructuralSignatureSchema.safeParse(signature);
    if (!parsed.success) {
      return context.json({ error: "abstract_signature_required" }, 400);
    }
    return context.json({ match: null, threshold: 0.92 });
  });
  return routes;
};
