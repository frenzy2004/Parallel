import { describe, expect, it, vi } from "vitest";
import type {
  StructuralSignature,
  TwinRender,
} from "@parallel/contracts";
import type { TwinEvent } from "@parallel/contracts/events";
import { compileVerifiedTwin } from "@parallel/statics-patterns";
import { createTwinEngineFromEnv, TwinEngine } from "../engine.js";
import { ExaEvidenceProvider } from "./exa.js";
import { OpenAITwinProvider } from "./openai.js";

const secretCrop = "data:image/png;base64,c2VjcmV0LXN0dWRlbnQtd29yaw==";
const safeQuery =
  "introductory 2D statics worked example moment about point counter-clockwise positive";

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
  originalAnchorRegions: [
    {
      anchorId: "moment-center",
      region: { x: 0.08, y: 0.42, width: 0.12, height: 0.18 },
    },
    {
      anchorId: "force-line",
      region: { x: 0.68, y: 0.18, width: 0.16, height: 0.5 },
    },
  ],
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
      workedStepIds: ["moment"],
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
    let fetchHeaders: Headers | undefined;
    const fetchImpl = vi.fn(async (
      _url: string | URL | Request,
      init?: RequestInit,
    ) => {
      fetchBody = JSON.parse(String(init?.body));
      fetchHeaders = new Headers(init?.headers);
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
      includeDomains: [
        "engineeringstatics.org",
        "eng.libretexts.org",
        "ocw.mit.edu",
        "pressbooks.library.upei.ca",
      ],
      contents: { highlights: true },
    });
    expect(fetchHeaders?.get("authorization")).toBe("Bearer exa-test");
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

  it("uses classifier-only image input, a strict format, low reasoning, and no storage", async () => {
    const calls: unknown[] = [];
    const requestOptions: unknown[] = [];
    const client = {
      responses: {
        parse: vi.fn(async (request: unknown, options?: unknown) => {
          calls.push(request);
          requestOptions.push(options);
          return {
            output_parsed: {
              disposition: "supported",
              patternId: "moment_about_point",
              confidence: 0.96,
              hasSufficientContext: true,
              originalAnchorRegions: signature.originalAnchorRegions,
            },
          };
        }),
      },
    };
    const provider = new OpenAITwinProvider(client);
    const controller = new AbortController();

    await provider.parseStructure(
      secretCrop,
      "statics-2d-v1",
      undefined,
      controller.signal,
    );

    const recognition = calls[0] as Record<string, unknown>;
    const input = recognition.input as Array<Record<string, unknown>>;
    const content = input[1]?.content as Array<Record<string, unknown>>;
    expect(recognition).toMatchObject({
      model: "gpt-5.6-terra",
      store: false,
      reasoning: { effort: "low" },
    });
    expect(content).toEqual([{
      type: "input_image",
      image_url: secretCrop,
      detail: "auto",
    }]);
    expect((recognition.text as { format?: unknown }).format).toBeDefined();
    expect(requestOptions).toEqual([{ signal: controller.signal }]);
    expect(calls).toHaveLength(1);
  });

  it("marks non-Statics and active-assessment classifications for a generic refusal", async () => {
    const makeProvider = (disposition: "unsupported" | "active_assessment") =>
      new OpenAITwinProvider({
        responses: {
          parse: vi.fn(async () => ({
            output_parsed: {
              disposition,
              patternId: "moment_about_point",
              confidence: 0,
              hasSufficientContext: false,
              originalAnchorRegions: [],
            },
          })),
        },
      });

    const unsupported = await makeProvider("unsupported").parseStructure(
      secretCrop,
      "statics-2d-v1",
    );
    const assessment = await makeProvider("active_assessment").parseStructure(
      secretCrop,
      "statics-2d-v1",
    );

    expect(unsupported.missingContext).toEqual([
      "__parallel_unsupported_selection__",
    ]);
    expect(assessment.missingContext).toEqual([
      "__parallel_active_assessment__",
    ]);
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

  it.each([
    {
      name: "pattern mismatch",
      unsafeTwin: { ...twin, patternId: "couple_moments" as const },
    },
    {
      name: "low confidence",
      unsafeTwin: { ...twin, confidence: 0.79 },
    },
    {
      name: "rejection",
      unsafeTwin: { ...twin, rejectionReason: "not course-compatible" },
    },
  ])("fails closed on $name from compilation", async ({ unsafeTwin }) => {
    const engine = new TwinEngine({
      structure: { parseStructure: async () => signature },
      evidence: { search: async () => [] },
      compiler: { compileTwin: async () => unsafeTwin },
    });
    const states: string[] = [];
    for await (const event of engine.stream({
      cropDataUrl: secretCrop,
      coursePackId: "statics-2d-v1",
    })) {
      states.push(event.state);
    }

    expect(states).not.toContain("complete");
    expect(states.at(-1)).toBe("error");
  });

  it("uses only evidence-backed source references in the completed twin", async () => {
    const evidence = {
      title: "MIT OpenCourseWare",
      url: "https://ocw.mit.edu/courses/statics",
      highlight: "Equilibrium source",
    };
    const engine = new TwinEngine({
      structure: { parseStructure: async () => signature },
      evidence: { search: async () => [evidence] },
      compiler: {
        compileTwin: async (receivedSignature, _evidence, seed) => ({
          ...compileVerifiedTwin(receivedSignature, seed),
          sourceRefs: [
            {
              title: "Invented",
              url: "https://answers.invalid/copied",
              highlight: "Untrusted",
            },
          ],
        }),
      },
    });
    const events: TwinEvent[] = [];
    for await (const event of engine.stream({
      cropDataUrl: secretCrop,
      coursePackId: "statics-2d-v1",
    })) {
      events.push(event);
    }

    const completed = events.at(-1);
    expect(completed?.state).toBe("complete");
    if (completed?.state === "complete") {
      expect(completed.twin.sourceRefs).toEqual([evidence]);
    }
  });

  it("fails closed when recognized anchor regions cannot join the canonical map", async () => {
    const engine = new TwinEngine({
      structure: {
        parseStructure: async () => ({
          ...signature,
          originalAnchorRegions: [
            {
              anchorId: "force-system",
              region: { x: 0.1, y: 0.1, width: 0.3, height: 0.3 },
            },
          ],
        }),
      },
      evidence: { search: async () => [] },
      compiler: {
        compileTwin: async (receivedSignature, _evidence, seed) =>
          compileVerifiedTwin(receivedSignature, seed),
      },
    });
    const states: string[] = [];
    for await (const event of engine.stream({
      cropDataUrl: secretCrop,
      coursePackId: "statics-2d-v1",
    })) {
      states.push(event.state);
    }

    expect(states).not.toContain("complete");
    expect(states.at(-1)).toBe("error");
  });
});
