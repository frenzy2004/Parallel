import { createDemoHandler } from "@/lib/demo-route";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = createDemoHandler();
