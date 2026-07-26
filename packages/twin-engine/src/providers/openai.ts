import {
  StructuralSignatureSchema,
  TwinRenderSchema,
  type SourceRef,
  type StructuralSignature,
  type TwinRender,
} from "@parallel/contracts";
import { zodTextFormat } from "openai/helpers/zod";
import type { CompilerProvider, StructureProvider } from "./types.js";

interface ResponsesClient {
  responses: {
    parse(request: unknown): Promise<{ output_parsed: unknown }>;
  };
}

interface OpenAIProviderOptions {
  recognitionModel?: string;
  compilationModel?: string;
}

const PARSER_SYSTEM_PROMPT =
  "Classify only 2D Statics. Extract an abstract structural signature. Never infer or return the original final answer. Missing or low-confidence context must be explicit. Produce a privacy-safe conceptual Exa query.";

const COMPILER_SYSTEM_PROMPT =
  "Create a fully worked structural twin with different surface details. Preserve the declared Statics invariant and course convention. Never solve, quote, or include the original final answer. Return strict structured data only.";

export class OpenAITwinProvider implements StructureProvider, CompilerProvider {
  private readonly recognitionModel: string;
  private readonly compilationModel: string;

  constructor(
    private readonly client: ResponsesClient,
    options: OpenAIProviderOptions = {},
  ) {
    this.recognitionModel =
      options.recognitionModel ??
      process.env.OPENAI_RECOGNITION_MODEL ??
      "gpt-5.6-luna";
    this.compilationModel =
      options.compilationModel ??
      process.env.OPENAI_COMPILATION_MODEL ??
      "gpt-5.6-terra";
  }

  async parseStructure(
    cropDataUrl: string,
    coursePackId: string,
    attemptContext?: string,
  ): Promise<StructuralSignature> {
    const response = await this.client.responses.parse({
      model: this.recognitionModel,
      store: false,
      reasoning: { effort: "low" },
      text: {
        format: zodTextFormat(StructuralSignatureSchema, "structural_signature"),
      },
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: PARSER_SYSTEM_PROMPT }],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Course pack: ${coursePackId}. Attempt context: ${attemptContext ?? "none provided"}.`,
            },
            {
              type: "input_image",
              image_url: cropDataUrl,
              detail: "auto",
            },
          ],
        },
      ],
    });
    return StructuralSignatureSchema.parse(response.output_parsed);
  }

  async compileTwin(
    signature: StructuralSignature,
    evidence: SourceRef[],
    seed: number,
  ): Promise<TwinRender> {
    const response = await this.client.responses.parse({
      model: this.compilationModel,
      store: false,
      reasoning: { effort: "low" },
      text: { format: zodTextFormat(TwinRenderSchema, "twin_render") },
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: COMPILER_SYSTEM_PROMPT }],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({ signature, evidence, seed }),
            },
          ],
        },
      ],
    });
    return TwinRenderSchema.parse(response.output_parsed);
  }
}

export type { ResponsesClient };
