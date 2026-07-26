import {
  StructuralSignatureSchema,
  TwinRenderSchema,
  type SourceRef,
  type StructuralSignature,
  type TwinRender,
} from "@parallel/contracts";
import { compileVerifiedTwin } from "@parallel/statics-patterns";
import type {
  CompilerProvider,
  EvidenceProvider,
  StructureProvider,
} from "./types.js";
import { PROVIDER_UNAVAILABLE_MARKER } from "./types.js";

export class DemoStructureProvider implements StructureProvider {
  async parseStructure(): Promise<StructuralSignature> {
    return StructuralSignatureSchema.parse({
      domain: "statics_2d",
      patternId: "moment_about_point",
      entities: ["applied force", "moment center", "perpendicular distance"],
      relationships: ["force line of action is offset from the moment center"],
      constraints: ["counter-clockwise moments are positive"],
      goal: "determine the signed moment about the selected point",
      invariant: "moment equals force times perpendicular distance",
      courseConvention: "counter-clockwise positive",
      missingContext: [],
      confidence: 0.97,
      exaQuery:
        "introductory 2D statics worked example moment about point counter-clockwise positive",
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
    });
  }
}

export class UnavailableStructureProvider
  extends DemoStructureProvider
  implements StructureProvider
{
  override async parseStructure(): Promise<StructuralSignature> {
    const signature = await super.parseStructure();
    return {
      ...signature,
      missingContext: [PROVIDER_UNAVAILABLE_MARKER],
    };
  }
}

export class DemoEvidenceProvider implements EvidenceProvider {
  async search(): Promise<SourceRef[]> {
    return [
      {
        title: "Engineering Statics — Moments",
        url: "https://engineeringstatics.org/Chapter_04-moments.html",
        highlight: "A force moment measures rotational tendency about a point.",
      },
    ];
  }
}

export class VerifiedCompilerProvider implements CompilerProvider {
  async compileTwin(
    signature: StructuralSignature,
    evidence: SourceRef[],
    seed: number,
  ): Promise<TwinRender> {
    return TwinRenderSchema.parse({
      ...compileVerifiedTwin(signature, seed),
      sourceRefs: evidence,
    });
  }
}

export class DemoCompilerProvider extends VerifiedCompilerProvider {}
