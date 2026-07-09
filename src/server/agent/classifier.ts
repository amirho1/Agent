import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { AgentMode, AgentTaskState } from "../../shared/agent-types";
import { agentSystemPrompt } from "./system-prompt";
import { agentClassificationSchema, type AgentClassification } from "./schemas";

/**
 * Classify the user request into an agent mode.
 * @param llm - LangChain chat model.
 * @param message - User message.
 * @param taskState - Current task state.
 * @returns Classification result.
 */
export async function classifyAgentRequest(
  llm: BaseChatModel,
  message: string,
  taskState: AgentTaskState,
): Promise<AgentClassification> {
  const structuredLlm = llm.withStructuredOutput(agentClassificationSchema);
  return structuredLlm.invoke([
    new SystemMessage(agentSystemPrompt),
    new HumanMessage(
      [
        "Classify the next user request into exactly one AgentMode.",
        "Use the current task state to detect continuation requests.",
        "If required information is missing, choose the closest mode and include a concise clarificationQuestion.",
        "",
        `Current task state JSON: ${JSON.stringify(taskState)}`,
        "",
        `User request: ${message}`,
      ].join("\n"),
    ),
  ]);
}

/**
 * Classify a request using deterministic rules for tests and fallbacks.
 * @param message - User message.
 * @param taskState - Current task state.
 * @returns Agent mode.
 */
export function classifyAgentRequestHeuristically(
  message: string,
  taskState: AgentTaskState,
): AgentMode {
  const normalizedMessage = message.toLowerCase();

  if (mentionsExecution(normalizedMessage)) {
    return "execute_approved_action";
  }

  if (mentionsApproval(normalizedMessage) && taskState.preparedPayload) {
    return "approval_required";
  }

  if (mentionsUpload(normalizedMessage)) {
    return "file_extraction";
  }

  if (mentionsPricePreparation(normalizedMessage)) {
    return "price_update_preparation";
  }

  if (mentionsPmsLookup(normalizedMessage)) {
    return "pms_lookup";
  }

  if (mentionsKnowledge(normalizedMessage)) {
    return "knowledge_answer";
  }

  return "general_chat";
}

/**
 * Check if a message asks for execution.
 * @param message - Normalized message.
 * @returns True when execution is requested.
 */
function mentionsExecution(message: string): boolean {
  return /execute|submit|run|approve and execute|تایید|اجرا/.test(message);
}

/**
 * Check if a message asks for approval.
 * @param message - Normalized message.
 * @returns True when approval is mentioned.
 */
function mentionsApproval(message: string): boolean {
  return /approve|confirm|تایید/.test(message);
}

/**
 * Check if a message is about uploaded files.
 * @param message - Normalized message.
 * @returns True when upload or extraction is mentioned.
 */
function mentionsUpload(message: string): boolean {
  return /upload|file|rate sheet|extract|parse|فایل/.test(message);
}

/**
 * Check if a message asks for price update preparation.
 * @param message - Normalized message.
 * @returns True when preparation is requested.
 */
function mentionsPricePreparation(message: string): boolean {
  return /update price|price update|prepare|diff|review|capacity|قیمت/.test(
    message,
  );
}

/**
 * Check if a message asks for live PMS data.
 * @param message - Normalized message.
 * @returns True when PMS lookup is requested.
 */
function mentionsPmsLookup(message: string): boolean {
  return /hotel|room|rate plan|children categor|pms|هتل|اتاق/.test(message);
}

/**
 * Check if a message asks for knowledge or documentation.
 * @param message - Normalized message.
 * @returns True when knowledge lookup is requested.
 */
function mentionsKnowledge(message: string): boolean {
  return /what|how|why|docs|documentation|guide|mean|stop.?sell|displayprice|api/.test(
    message,
  );
}
