import { z } from "zod";
import {
  StructuralSignatureSchema,
  TwinRenderSchema,
  WorkedStepSchema,
} from "./twin.js";

export const TwinEventSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("reading") }).strict(),
  z
    .object({
      state: z.literal("recognized"),
      label: z.string().min(1),
      signature: StructuralSignatureSchema,
    })
    .strict(),
  z
    .object({
      state: z.literal("twin_step"),
      index: z.number().int().nonnegative(),
      step: WorkedStepSchema,
    })
    .strict(),
  z.object({ state: z.literal("complete"), twin: TwinRenderSchema }).strict(),
  z
    .object({
      state: z.literal("recapture"),
      reason: z.string().min(1),
    })
    .strict(),
  z
    .object({
      state: z.literal("unsupported"),
      reason: z.string().min(1),
    })
    .strict(),
  z
    .object({
      state: z.literal("error"),
      message: z.string().min(1),
    })
    .strict(),
]);

export type TwinEvent = z.infer<typeof TwinEventSchema>;
