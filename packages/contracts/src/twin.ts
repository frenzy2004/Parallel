import { z } from "zod";

export const StaticsPatternIdSchema = z.enum([
  "concurrent_force_equilibrium",
  "resultant_coplanar_forces",
  "moment_about_point",
  "rigid_body_equilibrium_2d",
  "couple_moments",
  "equivalent_distributed_load",
]);

export const NormalizedRegionSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().positive().max(1),
    height: z.number().positive().max(1),
  })
  .strict()
  .refine(({ x, width }) => x + width <= 1, {
    message: "region extends beyond the lasso width",
  })
  .refine(({ y, height }) => y + height <= 1, {
    message: "region extends beyond the lasso height",
  });

export const OriginalAnchorRegionSchema = z
  .object({
    anchorId: z.string().min(1).max(64),
    region: NormalizedRegionSchema,
  })
  .strict();

export const StructuralSignatureSchema = z
  .object({
    domain: z.literal("statics_2d"),
    patternId: StaticsPatternIdSchema,
    entities: z.array(z.string().min(1)).min(1),
    relationships: z.array(z.string().min(1)).min(1),
    constraints: z.array(z.string().min(1)),
    goal: z.string().min(1),
    invariant: z.string().min(1),
    courseConvention: z.string().min(1),
    missingContext: z.array(z.string().min(1)),
    confidence: z.number().min(0).max(1),
    exaQuery: z.string().min(10).max(500),
    originalAnchorRegions: z
      .array(OriginalAnchorRegionSchema)
      .min(1)
      .max(8)
      .refine(
        (anchors) =>
          new Set(anchors.map((anchor) => anchor.anchorId)).size ===
          anchors.length,
        { message: "anchor ids must be unique" },
      ),
  })
  .strict();

export const WorkedStepSchema = z
  .object({
    id: z.string().min(1),
    explanation: z.string().min(1),
    expression: z.string().min(1),
  })
  .strict();

export const MappingEdgeSchema = z
  .object({
    twinAnchorId: z.string().min(1),
    originalAnchorId: z.string().min(1),
    label: z.string().min(1),
    workedStepIds: z.array(z.string().min(1)).min(1),
  })
  .strict();

export const SourceRefSchema = z
  .object({
    title: z.string().min(1),
    url: z.string().url(),
    highlight: z.string().min(1),
  })
  .strict();

export const TwinRenderSchema = z
  .object({
    patternId: StaticsPatternIdSchema,
    twinStatement: z.string().min(1),
    workedSteps: z.array(WorkedStepSchema).min(1),
    mappingEdges: z.array(MappingEdgeSchema).min(1),
    sourceRefs: z.array(SourceRefSchema),
    difficultyDelta: z.number().min(-1).max(1),
    answerLeak: z.literal(false),
    confidence: z.number().min(0).max(1),
    rejectionReason: z.string().min(1).nullable(),
  })
  .strict();

export const PrecedentOutcomeSchema = z.enum([
  "unlocked",
  "wrong_twin",
  "not_same",
  "dismissed",
]);

export const PrecedentSchema = z
  .object({
    signatureHash: z.string().min(1),
    patternId: StaticsPatternIdSchema,
    mappingSummary: z.string().min(1),
    twinStyle: z.string().min(1),
    outcome: PrecedentOutcomeSchema,
    laterTransferOutcome: PrecedentOutcomeSchema.nullable(),
    createdAt: z.string().datetime(),
  })
  .strict();

export const TwinRequestSchema = z
  .object({
    cropDataUrl: z
      .string()
      .regex(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/),
    coursePackId: z.string().min(1),
    attemptContext: z.string().max(1_000).optional(),
  })
  .strict();

export type StaticsPatternId = z.infer<typeof StaticsPatternIdSchema>;
export type NormalizedRegion = z.infer<typeof NormalizedRegionSchema>;
export type OriginalAnchorRegion = z.infer<typeof OriginalAnchorRegionSchema>;
export type StructuralSignature = z.infer<typeof StructuralSignatureSchema>;
export type WorkedStep = z.infer<typeof WorkedStepSchema>;
export type MappingEdge = z.infer<typeof MappingEdgeSchema>;
export type SourceRef = z.infer<typeof SourceRefSchema>;
export type TwinRender = z.infer<typeof TwinRenderSchema>;
export type PrecedentOutcome = z.infer<typeof PrecedentOutcomeSchema>;
export type Precedent = z.infer<typeof PrecedentSchema>;
export type TwinRequest = z.infer<typeof TwinRequestSchema>;
