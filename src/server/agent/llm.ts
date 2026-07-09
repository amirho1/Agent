import { ChatOpenAI } from "@langchain/openai";
import type { ServerConfig } from "../config";

/**
 * Create the OpenRouter-backed LangChain chat model.
 * @param config - Server config.
 * @returns Chat model.
 */
export function createAgentLlm(config: ServerConfig): ChatOpenAI {
  return new ChatOpenAI({
    model: config.agentModel,
    apiKey: config.openRouterApiKey,
    temperature: config.agentTemperature,
    maxTokens: config.agentMaxTokens,
    configuration: {
      baseURL: config.openRouterBaseUrl,
      defaultHeaders: {
        "HTTP-Referer": config.openRouterSiteUrl,
        "X-OpenRouter-Title": config.openRouterAppTitle,
        "X-OpenRouter-Categories": config.openRouterAppCategories,
      },
    },
  });
}
