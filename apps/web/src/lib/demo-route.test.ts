import type { TwinRequest } from "@parallel/contracts";
import { describe, expect, it } from "vitest";
import {
  createDemoHandler,
  type DemoEngineFactory,
} from "./demo-route";

const demoRequest = (body: unknown = {
  fixtureId: "moment-about-point-v1",
}): Request =>
  new Request("http://parallel.test/api/demo", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });

const untouchedFactory = (): DemoEngineFactory => () => {
  throw new Error("invalid demo requests must never create an engine");
};

describe("POST /api/demo", () => {
  it.each([
    {
      name: "multipart input",
      request: () => {
        const form = new FormData();
        form.append(
          "crop",
          new File([Uint8Array.from([1])], "private.png", {
            type: "image/png",
          }),
        );
        return new Request("http://parallel.test/api/demo", {
          method: "POST",
          body: form,
        });
      },
    },
    { name: "an empty object", request: () => demoRequest({}) },
    {
      name: "an unknown fixture",
      request: () => demoRequest({ fixtureId: "anything-else" }),
    },
    {
      name: "an extra field",
      request: () =>
        demoRequest({
          fixtureId: "moment-about-point-v1",
          cropDataUrl: "private pixels",
        }),
    },
  ])("strictly rejects $name", async ({ request }) => {
    const response = await createDemoHandler({
      createEngine: untouchedFactory(),
    })(request());

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "invalid_demo_request" },
    });
  });

  it("runs only the bundled fixed fixture and labels the response as non-upload analysis", async () => {
    let observedEnv: Record<string, string | undefined> | undefined;
    let observedInput: TwinRequest | undefined;
    let observedCropDataUrl = "";
    const factory: DemoEngineFactory = (env) => {
      observedEnv = env;
      return {
        async *stream(input) {
          observedInput = input;
          observedCropDataUrl = input.cropDataUrl;
          yield { state: "reading" };
          yield {
            state: "unsupported",
            reason: "A semantic result remains an event, not a fake twin.",
          };
        },
      };
    };

    const response = await createDemoHandler({
      createEngine: factory,
    })(demoRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      fixedDemo: true,
      analyzedUpload: false,
      fixtureId: "moment-about-point-v1",
      events: [
        { state: "reading" },
        {
          state: "unsupported",
          reason: "A semantic result remains an event, not a fake twin.",
        },
      ],
    });
    expect(observedEnv).toEqual({ PARALLEL_DEMO_MODE: "1" });
    expect(observedCropDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(observedInput).toMatchObject({
      cropDataUrl: "",
      coursePackId: "parallel-bundled-statics-demo",
    });
  });

  it("rejects malformed demo-engine events", async () => {
    const factory = (() => ({
      async *stream() {
        yield { state: "recognized", label: "made up" };
      },
    })) as DemoEngineFactory;

    const response = await createDemoHandler({
      createEngine: factory,
    })(demoRequest());

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: {
        code: "invalid_engine_response",
        message: "The bundled demo returned an invalid event.",
      },
    });
  });
});
