import type {
  SourceRef,
  StructuralSignature,
  TwinRender,
} from "@parallel/contracts";

export interface StructureProvider {
  parseStructure(
    cropDataUrl: string,
    coursePackId: string,
    attemptContext?: string,
  ): Promise<StructuralSignature>;
}

export interface EvidenceProvider {
  search(request: { query: string }): Promise<SourceRef[]>;
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
