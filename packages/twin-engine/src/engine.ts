import OpenAI from "openai";
import {
  TwinRenderSchema,
  TwinRequestSchema,
  type TwinRequest,
} from "@parallel/contracts";
import type { TwinEvent } from "@parallel/contracts/events";
import { compileVerifiedTwin } from "@parallel/statics-patterns";
import { canonicalizeSignature } from "./canonical-patterns.js";
import {
  DemoEvidenceProvider,
  DemoStructureProvider,
  VerifiedCompilerProvider,
} from "./providers/demo.js";
import { ExaEvidenceProvider } from "./providers/exa.js";
import {
  OpenAITwinProvider,
  type ResponsesClient,
} from "./providers/openai.js";
import type { TwinProviders } from "./providers/types.js";

export class TwinEngine {
  constructor(private readonly providers: TwinProviders) {}

  async *stream(input: TwinRequest): AsyncGenerator<TwinEvent> {
    const request = TwinRequestSchema.parse(input);
    yield { state: "reading" };
    try {
      const recognized = await this.providers.structure.parseStructure(
        request.cropDataUrl,
        request.coursePackId,
        request.attemptContext,
      );
      if (recognized.missingContext.length > 0 || recognized.confidence < 0.8) {
        yield {
          state: "recapture",
          reason: "Selection is incomplete. Widen the lasso and try again.",
        };
        return;
      }
      const signature = canonicalizeSignature(recognized);

      yield {
        state: "recognized",
        label: signature.patternId.replaceAll("_", " "),
        signature,
      };
      const evidence = await this.providers.evidence.search({
        query: signature.exaQuery,
      });
      const seed = stableSeed(signature.patternId);
      const compiledTwin = TwinRenderSchema.parse(
        await this.providers.compiler.compileTwin(
          signature,
          evidence,
          seed,
        ),
      );
      const verifiedTwin = compileVerifiedTwin(signature, seed);
      if (!matchesVerifiedTwin(compiledTwin, verifiedTwin)) {
        throw new Error("Compiled twin failed the structural safety gate");
      }
      const twin = TwinRenderSchema.parse({
        ...compiledTwin,
        sourceRefs: evidence.filter(isAllowlistedSource),
      });
      for (const [index, step] of twin.workedSteps.entries()) {
        yield { state: "twin_step", index, step };
      }
      yield { state: "complete", twin };
    } catch (error) {
      yield {
        state: "error",
        message: error instanceof Error ? error.message : "Twin generation failed",
      };
    }
  }
}

export const createTwinEngineFromEnv = (
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): TwinEngine => {
  const demoStructure = new DemoStructureProvider();
  const demoEvidence = new DemoEvidenceProvider();
  const verifiedCompiler = new VerifiedCompilerProvider();

  if (!env.OPENAI_API_KEY) {
    return new TwinEngine({
      structure: demoStructure,
      evidence: demoEvidence,
      compiler: verifiedCompiler,
    });
  }

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const client: ResponsesClient = {
    responses: {
      parse: (request) => openai.responses.parse(request as never),
    },
  };
  const openaiProvider = new OpenAITwinProvider(client, {
    ...(env.OPENAI_RECOGNITION_MODEL
      ? { recognitionModel: env.OPENAI_RECOGNITION_MODEL }
      : {}),
  });

  return new TwinEngine({
    structure: openaiProvider,
    evidence: env.EXA_API_KEY
      ? new ExaEvidenceProvider(env.EXA_API_KEY, fetchImpl)
      : demoEvidence,
    compiler: verifiedCompiler,
  });
};

const stableSeed = (value: string): number =>
  [...value].reduce((total, character) => total + character.charCodeAt(0), 0);

const SOURCE_DOMAINS = new Set([
  "engineeringstatics.org",
  "eng.libretexts.org",
  "ocw.mit.edu",
  "pressbooks.library.upei.ca",
]);

const isAllowlistedSource = (source: { url: string }): boolean => {
  try {
    return SOURCE_DOMAINS.has(new URL(source.url).hostname);
  } catch {
    return false;
  }
};

const matchesVerifiedTwin = (
  candidate: ReturnType<typeof TwinRenderSchema.parse>,
  verified: ReturnType<typeof compileVerifiedTwin>,
): boolean =>
  JSON.stringify({ ...candidate, sourceRefs: [] }) ===
  JSON.stringify({ ...verified, sourceRefs: [] });

export type { TwinProviders } from "./providers/types.js";
