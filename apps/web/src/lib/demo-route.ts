import { TwinRequestSchema, type TwinRequest } from "@parallel/contracts";
import {
  TwinEventSchema,
  type TwinEvent,
} from "@parallel/contracts/events";
import {
  createTwinEngineFromEnv,
  type TwinEngine,
} from "@parallel/twin-engine";
import { z } from "zod";
import { isValidTwinEventSequence } from "./event-sequence";

type DemoRuntimeEnv = Record<string, string | undefined>;

export type DemoEngineFactory = (
  env: DemoRuntimeEnv,
) => Pick<TwinEngine, "stream">;

type DemoHandlerDependencies = {
  createEngine?: DemoEngineFactory;
};

const DemoRequestSchema = z
  .object({
    fixtureId: z.literal("moment-about-point-v1"),
  })
  .strict();

const FIXED_DEMO_CROP_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

const json = (body: unknown, status: number): Response =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });

export const createDemoHandler = (
  dependencies: DemoHandlerDependencies = {},
): ((request: Request) => Promise<Response>) => {
  const createEngine =
    dependencies.createEngine ??
    ((env: DemoRuntimeEnv) => createTwinEngineFromEnv(env));

  return async (request: Request): Promise<Response> => {
    if (
      request.headers
        .get("content-type")
        ?.split(";", 1)[0]
        ?.trim()
        .toLowerCase() !== "application/json"
    ) {
      return invalidDemoRequest();
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return invalidDemoRequest();
    }
    const parsedBody = DemoRequestSchema.safeParse(body);
    if (!parsedBody.success) return invalidDemoRequest();

    let privateInput: TwinRequest | undefined;
    try {
      privateInput = TwinRequestSchema.parse({
        cropDataUrl: FIXED_DEMO_CROP_DATA_URL,
        coursePackId: "parallel-bundled-statics-demo",
      });
      const engine = createEngine({ PARALLEL_DEMO_MODE: "1" });
      const events: TwinEvent[] = [];
      for await (const candidate of engine.stream(privateInput, {
        signal: request.signal,
      })) {
        const parsedEvent = TwinEventSchema.safeParse(candidate);
        if (!parsedEvent.success) {
          return json(
            {
              error: {
                code: "invalid_engine_response",
                message: "The bundled demo returned an invalid event.",
              },
            },
            502,
          );
        }
        events.push(parsedEvent.data);
      }
      if (!isValidTwinEventSequence(events)) {
        return json(
          {
            error: {
              code: "invalid_engine_response",
              message: "The bundled demo returned an incomplete event sequence.",
            },
          },
          502,
        );
      }

      return json(
        {
          fixedDemo: true,
          analyzedUpload: false,
          fixtureId: parsedBody.data.fixtureId,
          events,
        },
        200,
      );
    } catch {
      return json(
        {
          error: {
            code: "demo_failed",
            message: "The bundled demo could not be generated.",
          },
        },
        500,
      );
    } finally {
      if (privateInput) privateInput.cropDataUrl = "";
      privateInput = undefined;
    }
  };
};

const invalidDemoRequest = (): Response =>
  json(
    {
      error: {
        code: "invalid_demo_request",
        message:
          "Request the bundled fixture with JSON { fixtureId: 'moment-about-point-v1' }.",
      },
    },
    400,
  );
