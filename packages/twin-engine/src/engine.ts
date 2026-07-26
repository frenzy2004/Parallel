import OpenAI from "openai";
import {
  SourceRefSchema,
  StructuralSignatureSchema,
  TwinRenderSchema,
  TwinRequestSchema,
  type SourceRef,
  type StructuralSignature,
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
    options: { signal?: AbortSignal; variation?: number } = {},
  ): AsyncGenerator<TwinEvent> {
    const request = TwinRequestSchema.parse(input);
    let privateCropDataUrl = request.cropDataUrl;
    request.cropDataUrl = "";
    input.cropDataUrl = "";
    if (options.signal?.aborted) return;
    yield { state: "reading" };
    try {
      let recognized: StructuralSignature;
      try {
        recognized = await this.providers.structure.parseStructure(
          privateCropDataUrl,
          request.coursePackId,
          request.attemptContext,
          options.signal,
        );
      } finally {
        privateCropDataUrl = "";
      }
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
      const twin = await this.compileTwin(
        signature,
        evidence,
        parseVariation(options.variation),
        options.signal,
      );
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

  async *regenerate(
    input: {
      signature: StructuralSignature;
      evidence: SourceRef[];
      variation: number;
    },
    options: { signal?: AbortSignal } = {},
  ): AsyncGenerator<TwinEvent> {
    if (options.signal?.aborted) return;
    yield { state: "reading" };
    try {
      const signature = canonicalizeSignature(
        StructuralSignatureSchema.parse(input.signature),
      );
      const evidence = input.evidence.map((source) =>
        SourceRefSchema.parse(source),
      );
      throwIfAborted(options.signal);
      yield {
        state: "recognized",
        label: signature.patternId.replaceAll("_", " "),
        signature,
      };
      const twin = await this.compileTwin(
        signature,
        evidence,
        parseVariation(input.variation),
        options.signal,
      );
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

  private async compileTwin(
    signature: StructuralSignature,
    evidence: SourceRef[],
    variation: number,
    signal: AbortSignal | undefined,
  ): Promise<ReturnType<typeof TwinRenderSchema.parse>> {
    const seed = stableSeed(signature.patternId) + variation;
    const compiledTwin = TwinRenderSchema.parse(
      await this.providers.compiler.compileTwin(signature, evidence, seed),
    );
    const verifiedTwin = compileVerifiedTwin(signature, seed);
    throwIfAborted(signal);
    if (!matchesVerifiedTwin(compiledTwin, verifiedTwin)) {
      throw new Error("Compiled twin failed the structural safety gate");
    }
    return TwinRenderSchema.parse({
      ...compiledTwin,
      sourceRefs: evidence.filter(isAllowlistedSource),
    });
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

const parseVariation = (value: number | undefined): number => {
  const variation = value ?? 0;
  if (
    !Number.isSafeInteger(variation) ||
    variation < 0 ||
    variation > 10_000
  ) {
    throw new Error("Invalid twin variation");
  }
  return variation;
};

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
