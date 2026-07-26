import type { TwinRequest } from "@parallel/contracts";
import { describe, expect, it } from "vitest";
import { createTwinsHandler, type TwinEngineFactory } from "./twin-route";

const pngFile = (
  bytes: Uint8Array<ArrayBuffer> = Uint8Array.from([
    137, 80, 78, 71, 13, 10, 26, 10,
  ]),
  type = "image/png",
): File => new File([bytes], "problem.png", { type });

const validForm = (): FormData => {
  const form = new FormData();
  form.append("crop", pngFile());
  form.append("coursePackId", "statics-2d");
  return form;
};

const uploadRequest = (form: FormData = validForm()): Request => {
  return new Request("http://parallel.test/api/twins", {
    method: "POST",
    body: form,
  });
};

const unusedEngineFactory = (): TwinEngineFactory => () => {
  throw new Error("invalid requests must never create an engine");
};

describe("POST /api/twins", () => {
  it("returns provider unavailable without ever creating an engine when the live key is absent", async () => {
    let factoryCalls = 0;
    const factory: TwinEngineFactory = () => {
      factoryCalls += 1;
      throw new Error("engine must stay untouched");
    };

    const response = await createTwinsHandler({
      env: {},
      createEngine: factory,
    })(uploadRequest());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: {
        code: "live_recognition_unavailable",
        message:
          "Live screenshot recognition is unavailable. Configure the OpenAI provider or try the bundled fixed demo.",
      },
    });
    expect(factoryCalls).toBe(0);
  });

  it("fails closed when the server is configured for demo mode even if a live key exists", async () => {
    let factoryCalls = 0;
    const factory: TwinEngineFactory = () => {
      factoryCalls += 1;
      throw new Error("the upload route must never create a demo engine");
    };

    const response = await createTwinsHandler({
      env: {
        OPENAI_API_KEY: "test-only-key",
        PARALLEL_DEMO_MODE: "1",
      },
      createEngine: factory,
    })(uploadRequest());

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: { code: "live_recognition_unavailable" },
    });
    expect(factoryCalls).toBe(0);
  });

  it.each([
    {
      name: "a non-multipart body",
      request: () =>
        new Request("http://parallel.test/api/twins", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        }),
    },
    {
      name: "a missing crop",
      request: () => {
        const form = new FormData();
        form.append("coursePackId", "statics-101");
        return uploadRequest(form);
      },
    },
    {
      name: "two crops",
      request: () => {
        const form = validForm();
        form.append("crop", pngFile());
        return uploadRequest(form);
      },
    },
    {
      name: "a string masquerading as a crop",
      request: () => {
        const form = validForm();
        form.delete("crop");
        form.append("crop", "not-a-file");
        return uploadRequest(form);
      },
    },
    {
      name: "an empty crop",
      request: () => {
        const form = validForm();
        form.set("crop", pngFile(new Uint8Array()));
        return uploadRequest(form);
      },
    },
    {
      name: "an oversized crop",
      request: () => {
        const form = validForm();
        const bytes = new Uint8Array(4 * 1024 * 1024 + 1);
        bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
        form.set("crop", pngFile(bytes));
        return uploadRequest(form);
      },
    },
    {
      name: "an unsupported media type",
      request: () => {
        const form = validForm();
        form.set("crop", pngFile(Uint8Array.from([1]), "image/gif"));
        return uploadRequest(form);
      },
    },
    {
      name: "PNG-labelled non-image bytes",
      request: () => {
        const form = validForm();
        form.set("crop", pngFile(Uint8Array.from([1, 2, 3, 4])));
        return uploadRequest(form);
      },
    },
    {
      name: "an unknown course pack",
      request: () => {
        const form = validForm();
        form.set("coursePackId", "calculus");
        return uploadRequest(form);
      },
    },
    {
      name: "a missing course pack",
      request: () => {
        const form = validForm();
        form.delete("coursePackId");
        return uploadRequest(form);
      },
    },
    {
      name: "two course packs",
      request: () => {
        const form = validForm();
        form.append("coursePackId", "statics-102");
        return uploadRequest(form);
      },
    },
    {
      name: "an unknown demo escape hatch",
      request: () => {
        const form = validForm();
        form.append("mode", "demo");
        return uploadRequest(form);
      },
    },
    {
      name: "two attempt contexts",
      request: () => {
        const form = validForm();
        form.append("attemptContext", "practice");
        form.append("attemptContext", "homework");
        return uploadRequest(form);
      },
    },
  ])("rejects $name before an engine can see it", async ({ request }) => {
    const response = await createTwinsHandler({
      env: { OPENAI_API_KEY: "test-only-key" },
      createEngine: unusedEngineFactory(),
    })(request());

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "invalid_request" },
    });
  });

  it("returns only schema-validated events from the live engine", async () => {
    let observedCropDataUrl = "";
    let retainedInput: TwinRequest | undefined;
    const factory: TwinEngineFactory = () => ({
      async *stream(input) {
        retainedInput = input;
        observedCropDataUrl = input.cropDataUrl;
        yield { state: "reading" };
        yield {
          state: "unsupported",
          reason: "PARALLEL supports complete 2D Statics problems only.",
        };
      },
    });
    const form = validForm();
    form.append("attemptContext", "guided practice");

    const response = await createTwinsHandler({
      env: { OPENAI_API_KEY: "test-only-key" },
      createEngine: factory,
    })(uploadRequest(form));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      events: [
        { state: "reading" },
        {
          state: "unsupported",
          reason: "PARALLEL supports complete 2D Statics problems only.",
        },
      ],
    });
    expect(observedCropDataUrl).toBe(
      "data:image/png;base64,iVBORw0KGgo=",
    );
    expect(retainedInput).toMatchObject({
      cropDataUrl: "",
      coursePackId: "statics-2d",
      attemptContext: "guided practice",
    });
  });

  it("rejects malformed provider events instead of forwarding them to the browser", async () => {
    const factory = (() => ({
      async *stream() {
        yield { state: "complete", twin: { fabricated: true } };
      },
    })) as TwinEngineFactory;

    const response = await createTwinsHandler({
      env: { OPENAI_API_KEY: "test-only-key" },
      createEngine: factory,
    })(uploadRequest());

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: {
        code: "invalid_engine_response",
        message: "The recognition provider returned an invalid event.",
      },
    });
  });
});
