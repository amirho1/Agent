import type { ServerConfig } from "../config";
import { fetchJson } from "../http";

type KnowledgeBaseListResponse = {
  data: Array<{
    id: string;
    name: string;
  }>;
};

export type KnowledgeBaseSearchResult = {
  rank: number;
  score: number;
  chunkId: string;
  sourceId: string;
  fileId: string;
  text?: string;
  textPreview: string;
  metadata?: Record<string, unknown>;
};

export type KnowledgeBaseSearchResponse = {
  queryId: string;
  tenantId: string;
  knowledgeBaseId: string;
  query: string;
  topK: number;
  resultCount: number;
  results: KnowledgeBaseSearchResult[];
  latencyMs: number;
  createdAt: string;
};

/**
 * Search the configured RAG-KBS knowledge base.
 * @param config - Server config.
 * @param query - Query text.
 * @returns RAG-KBS retrieval response.
 */
export async function searchKnowledgeBase(
  config: ServerConfig,
  query: string,
): Promise<KnowledgeBaseSearchResponse> {
  const knowledgeBaseId =
    config.ragKbsKnowledgeBaseId || (await getDefaultKnowledgeBaseId(config));

  return fetchJson<KnowledgeBaseSearchResponse>(
    `${config.ragKbsBaseUrl}/api/v1/query`,
    {
      method: "POST",
      headers: buildRagHeaders(config),
      body: {
        tenantId: config.ragKbsTenantId,
        knowledgeBaseId,
        query,
        topK: 6,
        includeMetadata: true,
        includeText: true,
      },
    },
  );
}

/**
 * Get the first active knowledge base for the configured tenant.
 * @param config - Server config.
 * @returns Knowledge base ID.
 */
async function getDefaultKnowledgeBaseId(
  config: ServerConfig,
): Promise<string> {
  const params = new URLSearchParams({
    tenantId: config.ragKbsTenantId,
    status: "ACTIVE",
    limit: "1",
  });

  const response = await fetchJson<KnowledgeBaseListResponse>(
    `${config.ragKbsBaseUrl}/api/v1/knowledge-bases?${params.toString()}`,
    {
      headers: buildRagHeaders(config),
    },
  );

  const knowledgeBase = response.data[0];
  if (!knowledgeBase) {
    throw new Error(
      `No active RAG-KBS knowledge base was found for tenant ${config.ragKbsTenantId}.`,
    );
  }

  return knowledgeBase.id;
}

/**
 * Build headers for RAG-KBS calls.
 * @param config - Server config.
 * @returns Request headers.
 */
function buildRagHeaders(config: ServerConfig): HeadersInit {
  if (!config.ragKbsApiKey) {
    return {};
  }

  return {
    authorization: `Bearer ${config.ragKbsApiKey}`,
  };
}
