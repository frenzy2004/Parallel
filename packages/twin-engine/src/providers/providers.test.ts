import { describe, expect, it, vi } from "vitest";
import type {
  StructuralSignature,
  TwinRender,
} from "@parallel/contracts";
import type { TwinEvent } from "@parallel/contracts/events";
import { createTwinEngineFromEnv } from "../engine.js";
import { ExaEvidenceProvider } from "./exa.js";
import { OpenAITwinProvider } from "./openai.js";

const secretCrop = "data:image/png;base64,c2VjcmV0LXN0dWRlbnQtd29yaw==";
const safeQuery =
  "introductory 2D statics worked example moment equilibrium counter-clockwise positive";

const signature: StructuralSignature = {
  domain: "statics_2d",
  patternId: "moment_about_point",
  entities: ["beam", "force"],
  relationships: ["force has a perpendicular lever arm"],
  constraints: ["counter-clockwise positive"],
  goal: "find a reaction moment",
  invariant: "ΣM about the selected point is zero",
  courseConvention: "counter-clockwise positive",
  missingContext: [],
  confidence: 0.96,
  exaQuery: safeQuery,
};

const twin: TwinRender = {
  patternId: "moment_about_point",
  twinStatement: "A sign bracket carries a load.",
  workedSteps: [
    {
      id: "moment",
      explanation: "Take moments about A.",
      expression: "ΣM_A = 0",
    },
  ],
  mappingEdges: [
    {
      twinAnchorId: "load",
      originalAnchorId: "load",
      label: "applied load",
    },
  ],
  sourceRefs: [],
  difficultyDelta: 0,
  answerLeak: false,
  confidence: 0.96,
  rejectionReason: null,
};

describe("provider privacy boundaries", () => {
  it("sends Exa only the abstract query", async () => {
    let fetchBody: unknown;
    const fetchImpl = vi.fn(async (
      _url: string | URL | Request,
      init?: RequestInit,
    ) => {
      fetchBody = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({
          results: [
            {
              title: "Moment of a Force",
              url: "https://engineeringstatics.org/Chapter_04-moments.html",
              highlights: ["A moment describes rotational tendency."],
            },
          ],
        }),
        { status: 200 },
      );
    });
    const provider = new ExaEvidenceProvider("exa-test", fetchImpl);

    await provider.search({ query: safeQuery, cropDataUrl: secretCrop } as never);

    expect(fetchBody).toEqual({
      query: safeQuery,
      type: "fast",
      numResults: 4,
      highlights: true,
    });
    expect(JSON.stringify(fetchBody)).not.toContain(secretCrop);
  });

  it("drops Exa results outside the teaching-domain allowlist", async () => {
    const provider = new ExaEvidenceProvider("exa-test", async () =>
      new Response(
        JSON.stringify({
          results: [
            {
              title: "Allowed",
              url: "https://ocw.mit.edu/courses/statics",
              highlights: ["Equilibrium example"],
            },
            {
              title: "Blocked",
              url: "https://answers.invalid/solution",
              highlights: ["Copied answer"],
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const results = await provider.search({ query: safeQuery });

    expect(results).toHaveLength(1);
    expect(results[0]?.url).toContain("ocw.mit.edu");
  });

  it("uses image input, strict formats, low reasoning, and no response storage", async () => {
    const calls: unknown[] = [];
    const client = {
      responses: {
        parse: vi.fn(async (request: unknown) => {
          calls.push(request);
          return { output_parsed: calls.length === 1 ? signature : twin };
        }),
      },
    };
    const provider = new OpenAITwinProvider(client);

    await provider.parseStructure(secretCrop, "statics-2d-v1");
    await provider.compileTwin(signature, [], 11);

    const recognition = calls[0] as Record<string, unknown>;
    const input = recognition.input as Array<Record<string, unknown>>;
    const content = input[1]?.content as Array<Record<string, unknown>>;
    expect(recognition).toMatchObject({
      model: "gpt-5.6-luna",
      store: false,
      reasoning: { effort: "low" },
    });
    expect(content[1]).toEqual({
      type: "input_image",
      image_url: secretCrop,
      detail: "auto",
    });
    expect((recognition.text as { format?: unknown }).format).toBeDefined();

    expect(calls[1]).toMatchObject({
      model: "gpt-5.6-terra",
      store: false,
      reasoning: { effort: "low" },
    });
  });

  it("streams a deterministic no-key demo without network access", async () => {
    const engine = createTwinEngineFromEnv({});
    const events: TwinEvent[] = [];
    for await (const event of engine.stream({
      cropDataUrl: secretCrop,
      coursePackId: "statics-2d-v1",
    })) {
      events.push(event);
    }

    expect(events.map((event) => event.state)).toEqual([
      "reading",
      "recognized",
      "twin_step",
      "twin_step",
      "complete",
    ]);
    expect(events.at(-1)).not.toHaveProperty("originalAnswer");
  });
});
