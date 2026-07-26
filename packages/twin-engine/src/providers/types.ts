import type {
  SourceRef,
  StructuralSignature,
  TwinRender,
} from "@parallel/contracts";

export const UNSUPPORTED_SELECTION_MARKER =
  "__parallel_unsupported_selection__";
export const ACTIVE_ASSESSMENT_MARKER =
  "__parallel_active_assessment__";
export const PROVIDER_UNAVAILABLE_MARKER =
  "__parallel_provider_unavailable__";

export interface StructureProvider {
  parseStructure(
    cropDataUrl: string,
    coursePackId: string,
    attemptContext?: string,
    signal?: AbortSignal,
  ): Promise<StructuralSignature>;
}

export interface EvidenceProvider {
  search(request: { query: string; signal?: AbortSignal }): Promise<SourceRef[]>;
}

export interface CompilerProvider {
  compileTwin(
    signature: StructuralSignature,
    evidence: SourceRef[],
    seed: number,
  ): Promise<TwinRender>;
}

export interface TwinProviders {
  structure: StructureProvider;
  evidence: EvidenceProvider;
  compiler: CompilerProvider;
}
