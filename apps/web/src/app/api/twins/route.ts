import { createTwinsHandler } from "@/lib/twin-route";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = createTwinsHandler();
