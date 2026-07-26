import {
  NormalizedRegionSchema,
  StaticsPatternIdSchema,
  type StructuralSignature,
} from "@parallel/contracts";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import {
  buildCanonicalSignature,
  hasCanonicalAnchorCoverage,
  placeholderAnchorRegions,
} from "../canonical-patterns.js";
import type { StructureProvider } from "./types.js";

interface ResponsesClient {
  responses: {
    parse(request: unknown): Promise<{ output_parsed: unknown }>;
  };
}

interface OpenAIProviderOptions {
  recognitionModel?: string;
}

const PARSER_SYSTEM_PROMPT =
  "Classify the image into one allowlisted 2D Statics pattern and locate only its canonical original features as tight normalized boxes inside the crop. Return no OCR, names, identifiers, problem prose, numerical values, queries, or answers. Box coordinates use top-left x/y plus width/height in 0..1 and must remain fully inside the crop. Canonical anchors: concurrent_force_equilibrium=force-intersection; resultant_coplanar_forces=force-system; moment_about_point=moment-center,force-line; rigid_body_equilibrium_2d=pin-support,tension-member; couple_moments=opposite-force-pair; equivalent_distributed_load=distributed-load,load-centroid.";

const CanonicalAnchorIdSchema = z.enum([
  "force-intersection",
  "force-system",
  "moment-center",
  "force-line",
  "pin-support",
  "tension-member",
  "opposite-force-pair",
  "distributed-load",
  "load-centroid",
]);

const ModelRegionSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().positive().max(1),
    height: z.number().positive().max(1),
  })
  .strict();

const RecognitionResultSchema = z
  .object({
    patternId: StaticsPatternIdSchema,
    confidence: z.number().min(0).max(1),
    hasSufficientContext: z.boolean(),
    originalAnchorRegions: z
      .array(
        z
          .object({
            anchorId: CanonicalAnchorIdSchema,
            region: ModelRegionSchema,
          })
          .strict(),
      )
      .min(1)
      .max(2),
  })
  .strict();

export class OpenAITwinProvider implements StructureProvider {
  private readonly recognitionModel: string;

  constructor(
    private readonly client: ResponsesClient,
    options: OpenAIProviderOptions = {},
  ) {
    this.recognitionModel =
      options.recognitionModel ??
      process.env.OPENAI_RECOGNITION_MODEL ??
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
        format: zodTextFormat(RecognitionResultSchema, "statics_classification"),
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
    const classification = RecognitionResultSchema.parse(response.output_parsed);
    const originalAnchorRegions = classification.originalAnchorRegions.filter(
      ({ region }) => NormalizedRegionSchema.safeParse(region).success,
    );
    const hasUsableAnchors = hasCanonicalAnchorCoverage({
      patternId: classification.patternId,
      originalAnchorRegions,
    });
    const signature = buildCanonicalSignature(
      classification.patternId,
      classification.confidence,
      originalAnchorRegions.length > 0
        ? originalAnchorRegions
        : placeholderAnchorRegions(classification.patternId),
    );
    return (
      classification.hasSufficientContext &&
      hasUsableAnchors
    )
      ? signature
      : {
          ...signature,
          missingContext: ["insufficient visible anchor context"],
        };
  }
}

export type { ResponsesClient };
