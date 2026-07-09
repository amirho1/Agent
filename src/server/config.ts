export type ServerConfig = {
  appUrl: string;
  openRouterApiKey: string;
  openRouterBaseUrl: string;
  agentModel: string;
  agentTemperature: number;
  agentMaxTokens: number;
  openRouterSiteUrl: string;
  openRouterAppTitle: string;
  openRouterAppCategories: string;
  ragKbsBaseUrl: string;
  ragKbsTenantId: string;
  ragKbsKnowledgeBaseId: string;
  ragKbsApiKey: string;
  dummyPmsBaseUrl: string;
  dummyPmsAuthToken: string;
};

/**
 * Read a string environment variable with a fallback value.
 * @param key - Environment variable name.
 * @param fallback - Fallback value.
 * @returns Environment variable value.
 */
function readStringEnv(key: string, fallback: string): string {
  return process.env[key]?.trim() || fallback;
}

/**
 * Read a numeric environment variable with a fallback value.
 * @param key - Environment variable name.
 * @param fallback - Fallback value.
 * @returns Parsed number.
 */
function readNumberEnv(key: string, fallback: number): number {
  const rawValue = process.env[key]?.trim();
  if (!rawValue) {
    return fallback;
  }

  const value = Number(rawValue);
  return Number.isFinite(value) ? value : fallback;
}

/**
 * Read server configuration for API routes and agent modules.
 * @returns Server configuration.
 */
export function getServerConfig(): ServerConfig {
  return {
    appUrl: readStringEnv("APP_URL", "http://localhost:3001"),
    openRouterApiKey: readStringEnv("OPENROUTER_API_KEY", ""),
    openRouterBaseUrl: readStringEnv(
      "OPENROUTER_BASE_URL",
      "https://openrouter.ai/api/v1",
    ),
    agentModel: readStringEnv("AGENT_MODEL", ""),
    agentTemperature: readNumberEnv("AGENT_TEMPERATURE", 0.2),
    agentMaxTokens: readNumberEnv("AGENT_MAX_TOKENS", 1200),
    openRouterSiteUrl: readStringEnv(
      "OPENROUTER_SITE_URL",
      readStringEnv("APP_URL", "http://localhost:3001"),
    ),
    openRouterAppTitle: readStringEnv("OPENROUTER_APP_TITLE", "Agent"),
    openRouterAppCategories: readStringEnv(
      "OPENROUTER_APP_CATEGORIES",
      "productivity,developer-tools",
    ),
    ragKbsBaseUrl: readStringEnv("RAG_KBS_BASE_URL", "http://localhost:3000"),
    ragKbsTenantId: readStringEnv("RAG_KBS_TENANT_ID", "tenant_acme"),
    ragKbsKnowledgeBaseId: readStringEnv("RAG_KBS_KNOWLEDGE_BASE_ID", ""),
    ragKbsApiKey: readStringEnv("RAG_KBS_API_KEY", ""),
    dummyPmsBaseUrl: readStringEnv(
      "DUMMY_PMS_BASE_URL",
      "http://localhost:4000",
    ),
    dummyPmsAuthToken: readStringEnv("DUMMY_PMS_AUTH_TOKEN", "test-token"),
  };
}

/**
 * Ensure OpenRouter credentials required for chat are configured.
 * @param config - Server configuration.
 */
export function assertAgentLlmConfig(config: ServerConfig): void {
  if (!config.openRouterApiKey || !config.agentModel) {
    throw new Error(
      "Agent LLM is not configured. Set OPENROUTER_API_KEY and AGENT_MODEL in the Agent environment.",
    );
  }
}
