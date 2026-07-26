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
  UnavailableStructureProvider,
  VerifiedCompilerProvider,
} from "./providers/demo.js";
import { ExaEvidenceProvider } from "./providers/exa.js";
import {
  OpenAITwinProvider,
  type ResponsesClient,
} from "./providers/openai.js";
import {
  ACTIVE_ASSESSMENT_MARKER,
  PROVIDER_UNAVAILABLE_MARKER,
  UNSUPPORTED_SELECTION_MARKER,
  type TwinProviders,
} from "./providers/types.js";

export class TwinEngine {
  constructor(private readonly providers: TwinProviders) {}

  async *stream(
    input: TwinRequest,
    options: { signal?: AbortSignal } = {},
  ): AsyncGenerator<TwinEvent> {
    const request = TwinRequestSchema.parse(input);
    if (options.signal?.aborted) return;
    yield { state: "reading" };
    try {
      const recognized = await this.providers.structure.parseStructure(
        request.cropDataUrl,
        request.coursePackId,
        request.attemptContext,
        options.signal,
      );
      throwIfAborted(options.signal);
      if (recognized.missingContext.includes(UNSUPPORTED_SELECTION_MARKER)) {
        yield {
          state: "unsupported",
          reason: "PARALLEL supports complete 2D Statics problems only.",
        };
        return;
      }
      if (recognized.missingContext.includes(PROVIDER_UNAVAILABLE_MARKER)) {
        yield {
          state: "unsupported",
          reason:
            "Live recognition is off. Use the bundled demo or configure the provider.",
        };
        return;
      }
      if (recognized.missingContext.includes(ACTIVE_ASSESSMENT_MARKER)) {
        yield {
          state: "unsupported",
          reason: "PARALLEL is unavailable on active assessments.",
        };
        return;
      }
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
        ...(options.signal ? { signal: options.signal } : {}),
      });
      throwIfAborted(options.signal);
      const seed = stableSeed(signature.patternId);
      const compiledTwin = TwinRenderSchema.parse(
        await this.providers.compiler.compileTwin(
          signature,
          evidence,
          seed,
        ),
      );
      const verifiedTwin = compileVerifiedTwin(signature, seed);
      throwIfAborted(options.signal);
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
      if (options.signal?.aborted || isAbortError(error)) return;
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
  const demoStructure =
    env.PARALLEL_DEMO_MODE === "1"
      ? new DemoStructureProvider()
      : new UnavailableStructureProvider();
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
      parse: (request, options) =>
        openai.responses.parse(request as never, options),
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

const throwIfAborted = (signal: AbortSignal | undefined): void => {
  if (!signal?.aborted) return;
  throw signal.reason instanceof Error
    ? signal.reason
    : new DOMException("Aborted", "AbortError");
};

const isAbortError = (error: unknown): boolean =>
  error instanceof Error && error.name === "AbortError";

export type { TwinProviders } from "./providers/types.js";
