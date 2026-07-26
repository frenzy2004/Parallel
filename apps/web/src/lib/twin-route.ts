import {
  createTwinEngineFromEnv,
  type TwinEngine,
} from "@parallel/twin-engine";
import { TwinRequestSchema, type TwinRequest } from "@parallel/contracts";
import {
  TwinEventSchema,
  type TwinEvent,
} from "@parallel/contracts/events";
import { isValidTwinEventSequence } from "./event-sequence";

type RuntimeEnv = Record<string, string | undefined>;

export type TwinEngineFactory = (env: RuntimeEnv) => Pick<TwinEngine, "stream">;

type TwinsHandlerDependencies = {
  env?: RuntimeEnv;
  createEngine?: TwinEngineFactory;
};

// Leave multipart headroom below Vercel Functions' 4.5 MB request limit.
const MAX_CROP_BYTES = 4 * 1024 * 1024;
const CROP_MEDIA_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const FORM_FIELDS = new Set(["crop", "coursePackId", "attemptContext"]);

const json = (body: unknown, status: number): Response =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });

export const createTwinsHandler = (
  dependencies: TwinsHandlerDependencies = {},
): ((request: Request) => Promise<Response>) => {
  const env = dependencies.env ?? process.env;
  const createEngine =
    dependencies.createEngine ??
    ((runtimeEnv: RuntimeEnv) => createTwinEngineFromEnv(runtimeEnv));

  return async (_request: Request): Promise<Response> => {
    if (!env.OPENAI_API_KEY || env.PARALLEL_DEMO_MODE === "1") {
      return json(
        {
          error: {
            code: "live_recognition_unavailable",
            message:
              "Live screenshot recognition is unavailable. Configure the OpenAI provider or try the bundled fixed demo.",
          },
        },
        503,
      );
    }

    const parsedForm = await parseUploadForm(_request);
    if (!parsedForm.ok) {
      return invalidRequest(parsedForm.message);
    }

    let cropBytes: Uint8Array | undefined;
    let cropDataUrl = "";
    let privateInput: TwinRequest | undefined;
    try {
      cropBytes = new Uint8Array(await parsedForm.crop.arrayBuffer());
      if (!matchesCropSignature(cropBytes, parsedForm.crop.type)) {
        return invalidRequest(
          "The screenshot contents do not match its declared image type.",
        );
      }
      cropDataUrl = `data:${parsedForm.crop.type};base64,${Buffer.from(
        cropBytes.buffer,
        cropBytes.byteOffset,
        cropBytes.byteLength,
      ).toString("base64")}`;
      privateInput = TwinRequestSchema.parse({
        cropDataUrl,
        coursePackId: parsedForm.coursePackId,
        ...(parsedForm.attemptContext === undefined
          ? {}
          : { attemptContext: parsedForm.attemptContext }),
      });

      const events: TwinEvent[] = [];
      const engine = createEngine(env);
      for await (const candidate of engine.stream(privateInput, {
        signal: _request.signal,
      })) {
        const parsedEvent = TwinEventSchema.safeParse(candidate);
        if (!parsedEvent.success) {
          return json(
            {
              error: {
                code: "invalid_engine_response",
                message: "The recognition provider returned an invalid event.",
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
              message:
                "The recognition provider returned an incomplete event sequence.",
            },
          },
          502,
        );
      }

      return json({ events }, 200);
    } catch {
      return json(
        {
          error: {
            code: "generation_failed",
            message: "Twin generation failed. Please try again.",
          },
        },
        500,
      );
    } finally {
      cropBytes?.fill(0);
      cropBytes = undefined;
      cropDataUrl = "";
      if (privateInput) privateInput.cropDataUrl = "";
      privateInput = undefined;
    }
  };
};

type ParsedUploadForm =
  | {
      ok: true;
      crop: File;
      coursePackId: string;
      attemptContext?: string;
    }
  | { ok: false; message: string };

const parseUploadForm = async (request: Request): Promise<ParsedUploadForm> => {
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("multipart/form-data;")
  ) {
    return {
      ok: false,
      message: "Expected a multipart form upload.",
    };
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return { ok: false, message: "The multipart upload is malformed." };
  }

  if ([...form.keys()].some((field) => !FORM_FIELDS.has(field))) {
    return { ok: false, message: "The upload contains an unknown field." };
  }

  const crops = form.getAll("crop");
  if (crops.length !== 1 || !(crops[0] instanceof File)) {
    return {
      ok: false,
      message: "Upload exactly one screenshot in the crop field.",
    };
  }
  const crop = crops[0];
  if (!CROP_MEDIA_TYPES.has(crop.type)) {
    return {
      ok: false,
      message: "The screenshot must be a PNG, JPEG, or WebP image.",
    };
  }
  if (crop.size === 0 || crop.size > MAX_CROP_BYTES) {
    return {
      ok: false,
      message: "The screenshot must be nonempty and no larger than 4 MiB.",
    };
  }

  const coursePackValues = form.getAll("coursePackId");
  if (
    coursePackValues.length !== 1 ||
    typeof coursePackValues[0] !== "string" ||
    coursePackValues[0].trim() !== "statics-2d"
  ) {
    return {
      ok: false,
      message: "The current web workspace supports only statics-2d.",
    };
  }

  const attemptValues = form.getAll("attemptContext");
  if (
    attemptValues.length > 1 ||
    (attemptValues.length === 1 &&
      (typeof attemptValues[0] !== "string" ||
        attemptValues[0].length > 1_000))
  ) {
    return {
      ok: false,
      message: "Provide at most one attemptContext of 1,000 characters.",
    };
  }

  return {
    ok: true,
    crop,
    coursePackId: coursePackValues[0].trim(),
    ...(attemptValues.length === 1
      ? { attemptContext: attemptValues[0] as string }
      : {}),
  };
};

const invalidRequest = (message: string): Response =>
  json(
    {
      error: {
        code: "invalid_request",
        message,
      },
    },
    400,
  );

const startsWith = (bytes: Uint8Array, signature: number[]): boolean =>
  bytes.length >= signature.length &&
  signature.every((byte, index) => bytes[index] === byte);

const matchesCropSignature = (
  bytes: Uint8Array,
  mediaType: string,
): boolean => {
  if (mediaType === "image/png") {
    return startsWith(bytes, [137, 80, 78, 71, 13, 10, 26, 10]);
  }
  if (mediaType === "image/jpeg") {
    return startsWith(bytes, [255, 216, 255]);
  }
  if (mediaType === "image/webp") {
    return (
      startsWith(bytes, [82, 73, 70, 70]) &&
      bytes.length >= 12 &&
      bytes[8] === 87 &&
      bytes[9] === 69 &&
      bytes[10] === 66 &&
      bytes[11] === 80
    );
  }
  return false;
};
