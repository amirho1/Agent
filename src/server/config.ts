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
  lamasooBaseUrl: string;
  authorization: string;
  exchangeAuthorization: string;
};

function readStringEnv(key: string, fallback: string): string {
  return process.env[key]?.trim() || fallback;
}

function readNumberEnv(key: string, fallback: number): number {
  const rawValue = process.env[key]?.trim();
  if (!rawValue) {
    return fallback;
  }

  const value = Number(rawValue);
  return Number.isFinite(value) ? value : fallback;
}

export function normalizeBaseUrl(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

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
    lamasooBaseUrl: normalizeBaseUrl(
      readStringEnv("LAMASOO_BASE_URL", "https://whale.lamasoo.com/"),
    ),
    authorization: readStringEnv("AUTHORIZATION", ""),
    exchangeAuthorization: readStringEnv(
      "EXCHANGE_AUTHORIZATION",
      readStringEnv("AUTHORIZATION", ""),
    ),
  };
}

export function assertLamasooConfig(config: ServerConfig): void {
  if (!config.authorization) {
    throw new Error("Lamasoo API token is not configured. Set AUTHORIZATION.");
  }
}

export function assertLamasooExchangeConfig(config: ServerConfig): void {
  if (!config.exchangeAuthorization) {
    throw new Error(
      "Lamasoo exchange API token is not configured. Set EXCHANGE_AUTHORIZATION.",
    );
  }
}

export function assertAgentLlmConfig(config: ServerConfig): void {
  if (!config.openRouterApiKey || !config.agentModel) {
    throw new Error(
      "Agent LLM is not configured. Set OPENROUTER_API_KEY and AGENT_MODEL.",
    );
  }
}
