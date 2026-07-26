import OpenAI from "openai";
import {
  TwinRequestSchema,
  type TwinRequest,
} from "@parallel/contracts";
import type { TwinEvent } from "@parallel/contracts/events";
import {
  DemoCompilerProvider,
  DemoEvidenceProvider,
  DemoStructureProvider,
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
      const signature = await this.providers.structure.parseStructure(
        request.cropDataUrl,
        request.coursePackId,
        request.attemptContext,
      );
      if (signature.missingContext.length > 0 || signature.confidence < 0.8) {
        yield {
          state: "recapture",
          reason:
            signature.missingContext[0] ??
            "Selection confidence is too low. Widen the lasso.",
        };
        return;
      }

      yield {
        state: "recognized",
        label: signature.patternId.replaceAll("_", " "),
        signature,
      };
      const evidence = await this.providers.evidence.search({
        query: signature.exaQuery,
      });
      const seed = stableSeed(signature.patternId);
      const twin = await this.providers.compiler.compileTwin(
        signature,
        evidence,
        seed,
      );
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
  const demoCompiler = new DemoCompilerProvider();

  if (!env.OPENAI_API_KEY) {
    return new TwinEngine({
      structure: demoStructure,
      evidence: demoEvidence,
      compiler: demoCompiler,
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
    ...(env.OPENAI_COMPILATION_MODEL
      ? { compilationModel: env.OPENAI_COMPILATION_MODEL }
      : {}),
  });

  return new TwinEngine({
    structure: openaiProvider,
    evidence: env.EXA_API_KEY
      ? new ExaEvidenceProvider(env.EXA_API_KEY, fetchImpl)
      : demoEvidence,
    compiler: openaiProvider,
  });
};

const stableSeed = (value: string): number =>
  [...value].reduce((total, character) => total + character.charCodeAt(0), 0);

export type { TwinProviders } from "./providers/types.js";
