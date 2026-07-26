import { SourceRefSchema, type SourceRef } from "@parallel/contracts";
import type { EvidenceProvider } from "./types.js";
import { isCanonicalExaQuery } from "../canonical-patterns.js";

const EXA_ENDPOINT = "https://api.exa.ai/search";
const INCLUDED_DOMAINS = [
  "engineeringstatics.org",
  "eng.libretexts.org",
  "ocw.mit.edu",
  "pressbooks.library.upei.ca",
] as const;
const ALLOWED_DOMAINS = new Set<string>(INCLUDED_DOMAINS);

interface ExaResult {
  title?: unknown;
  url?: unknown;
  highlights?: unknown;
}

export class ExaEvidenceProvider implements EvidenceProvider {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async search(request: {
    query: string;
    signal?: AbortSignal;
  }): Promise<SourceRef[]> {
    if (!isCanonicalExaQuery(request.query)) {
      throw new Error("Exa query is not an allowlisted canonical query");
    }
    const response = await this.fetchImpl(EXA_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        query: request.query,
        type: "fast",
        numResults: 4,
        includeDomains: INCLUDED_DOMAINS,
        contents: { highlights: true },
      }),
      ...(request.signal ? { signal: request.signal } : {}),
    });
    if (!response.ok) {
      throw new Error(`Exa search failed with ${response.status}`);
    }

    const payload = (await response.json()) as { results?: ExaResult[] };
    return (payload.results ?? []).flatMap((result) => {
      if (
        typeof result.title !== "string" ||
        typeof result.url !== "string" ||
        !Array.isArray(result.highlights) ||
        typeof result.highlights[0] !== "string"
      ) {
        return [];
      }
      let hostname: string;
      try {
        hostname = new URL(result.url).hostname;
      } catch {
        return [];
      }
      if (!ALLOWED_DOMAINS.has(hostname)) {
        return [];
      }
      return [
        SourceRefSchema.parse({
          title: result.title,
          url: result.url,
          highlight: result.highlights[0],
        }),
      ];
    });
  }
}

export { ALLOWED_DOMAINS, INCLUDED_DOMAINS };
