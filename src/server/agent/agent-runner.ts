import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type {
  AgentMode,
  AgentResponse,
  AgentTaskState,
  Hotel,
  ToolCallResult,
} from "../../shared/agent-types";
import { assertAgentLlmConfig, getServerConfig } from "../config";
import { normalizeName } from "../price-updates/matching";
import { agentMessageSchema, type ChatRequestInput } from "./schemas";
import {
  classifyAgentRequest,
  classifyAgentRequestHeuristically,
} from "./classifier";
import { createAgentLlm } from "./llm";
import { agentSystemPrompt } from "./system-prompt";
import { createAgentTools } from "./tools";

/**
 * Run the hotel operations agent for one user message.
 * @param input - Chat request input.
 * @returns Structured agent response.
 */
export async function runAgent(
  input: ChatRequestInput,
): Promise<AgentResponse> {
  const config = getServerConfig();
  assertAgentLlmConfig(config);

  const llm = createAgentLlm(config);
  const taskState: AgentTaskState = {
    ...(input.taskState ?? {}),
  };
  const tools = createAgentTools(config, taskState);
  const toolCalls: ToolCallResult[] = [];
  const classification = await classifyAgentRequest(
    llm,
    input.message,
    taskState,
  );
  const mode =
    classification.mode ??
    classifyAgentRequestHeuristically(input.message, taskState);

  if (
    classification.clarificationQuestion &&
    needsClarification(mode, taskState)
  ) {
    return {
      message: classification.clarificationQuestion,
      mode,
      toolCalls,
      taskState,
      uiAction: { type: "show_message" },
    };
  }

  try {
    const response = await runModeHandler({
      mode,
      message: input.message,
      taskState,
      toolCalls,
      tools,
      llm,
      config,
    });

    return response;
  } catch (error) {
    return {
      message: getErrorMessage(error),
      mode,
      toolCalls,
      taskState,
      uiAction: { type: "show_message" },
    };
  }
}

type ModeHandlerInput = {
  mode: AgentMode;
  message: string;
  taskState: AgentTaskState;
  toolCalls: ToolCallResult[];
  tools: ReturnType<typeof createAgentTools>;
  llm: BaseChatModel;
  config: ReturnType<typeof getServerConfig>;
};

type InvokableTool = {
  name: string;
  invoke: (input: never) => Promise<unknown>;
};

/**
 * Run the handler for a classified mode.
 * @param input - Mode handler input.
 * @returns Agent response.
 */
async function runModeHandler(input: ModeHandlerInput): Promise<AgentResponse> {
  switch (input.mode) {
    case "knowledge_answer":
      return handleKnowledgeAnswer(input);
    case "pms_lookup":
      return handlePmsLookup(input);
    case "file_extraction":
      return handleFileExtraction(input);
    case "price_update_preparation":
      return handlePriceUpdatePreparation(input);
    case "approval_required":
      return handleApprovalRequired(input);
    case "execute_approved_action":
      return handleExecuteApprovedAction(input);
    case "general_chat":
    default:
      return handleGeneralChat(input);
  }
}

/**
 * Answer a knowledge question with RAG-KBS context.
 * @param input - Mode handler input.
 * @returns Agent response.
 */
async function handleKnowledgeAnswer(
  input: ModeHandlerInput,
): Promise<AgentResponse> {
  const result = await invokeTool(
    input.tools.searchKnowledgeBaseTool,
    { query: input.message },
    input.toolCalls,
  );
  const message = await createFinalMessage(
    input.llm,
    input.mode,
    input.message,
    {
      taskState: input.taskState,
      toolResult: result,
    },
  );

  return {
    message,
    mode: input.mode,
    toolCalls: input.toolCalls,
    taskState: input.taskState,
    uiAction: { type: "show_message" },
  };
}

/**
 * Fetch PMS data or select a hotel from live PMS data.
 * @param input - Mode handler input.
 * @returns Agent response.
 */
async function handlePmsLookup(
  input: ModeHandlerInput,
): Promise<AgentResponse> {
  const hotels = (await invokeTool(
    input.tools.listHotelsTool,
    {},
    input.toolCalls,
  )) as Hotel[];
  const selectedHotel = findHotelFromMessage(input.message, hotels);

  if (selectedHotel) {
    input.taskState.selectedHotel = selectedHotel;
    const [rooms, ratePlans] = await Promise.all([
      invokeTool(
        input.tools.listRoomTypesTool,
        { hotelId: selectedHotel.id },
        input.toolCalls,
      ),
      invokeTool(
        input.tools.listRatePlansTool,
        { hotelId: selectedHotel.id },
        input.toolCalls,
      ),
    ]);

    return {
      message: `I selected ${selectedHotel.name} and found ${countItems(
        rooms,
      )} rooms and ${countItems(ratePlans)} rate plans.`,
      mode: input.mode,
      toolCalls: input.toolCalls,
      taskState: input.taskState,
      uiAction: {
        type: "show_hotel_selector",
        payload: { hotels, selectedHotel },
      },
    };
  }

  return {
    message: "Choose a hotel so I can fetch its live PMS rooms and rate plans.",
    mode: input.mode,
    toolCalls: input.toolCalls,
    taskState: input.taskState,
    uiAction: {
      type: "show_hotel_selector",
      payload: { hotels },
    },
  };
}

/**
 * Summarize uploaded file extraction state.
 * @param input - Mode handler input.
 * @returns Agent response.
 */
async function handleFileExtraction(
  input: ModeHandlerInput,
): Promise<AgentResponse> {
  const extractedRateSheet = input.taskState.extractedRateSheet;
  if (!extractedRateSheet) {
    return {
      message:
        "Upload a text or Markdown rate sheet first. I will parse it before preparing updates.",
      mode: input.mode,
      toolCalls: input.toolCalls,
      taskState: input.taskState,
      uiAction: { type: "show_message" },
    };
  }

  return {
    message: `I extracted ${extractedRateSheet.dateRanges.length} date ranges and ${countExtractedRows(
      extractedRateSheet,
    )} room-price rows.`,
    mode: input.mode,
    toolCalls: input.toolCalls,
    taskState: input.taskState,
    uiAction: {
      type: "show_extracted_table",
      payload: extractedRateSheet,
    },
  };
}

/**
 * Prepare a draft price-capacity update for review.
 * @param input - Mode handler input.
 * @returns Agent response.
 */
async function handlePriceUpdatePreparation(
  input: ModeHandlerInput,
): Promise<AgentResponse> {
  if (!input.taskState.selectedHotel) {
    return {
      message: "Select a hotel before I prepare a price update.",
      mode: input.mode,
      toolCalls: input.toolCalls,
      taskState: input.taskState,
      uiAction: { type: "show_hotel_selector" },
    };
  }

  // if (!input.taskState.extractedRateSheet) {
  //   return {
  //     message:
  //       "Upload a text or Markdown rate sheet before I prepare a price update.",
  //     mode: input.mode,
  //     toolCalls: input.toolCalls,
  //     taskState: input.taskState,
  //     uiAction: { type: "show_message" },
  //   };
  // }

  const result = (await invokeTool(
    input.tools.preparePriceCapacityUpsertTool,
    {
      hotel: input.taskState.selectedHotel,
      extractedRateSheet: input.taskState.extractedRateSheet,
    },
    input.toolCalls,
  )) as {
    diffRows: unknown[];
    validationIssues: Array<{ level: string }>;
    preparedPayload: { items: unknown[] };
  };
  const blockingErrors = result.validationIssues.filter(
    (issue) => issue.level === "error",
  ).length;

  return {
    message: `I prepared a draft with ${result.diffRows.length} review rows and ${result.preparedPayload.items.length} executable rows. ${blockingErrors} blocking issues need review.`,
    mode: input.mode,
    toolCalls: input.toolCalls,
    taskState: input.taskState,
    uiAction: {
      type: "show_diff_table",
      payload: {
        diffRows: input.taskState.diffRows,
        validationIssues: input.taskState.validationIssues,
      },
    },
  };
}

/**
 * Mark a prepared draft as waiting for approval.
 * @param input - Mode handler input.
 * @returns Agent response.
 */
async function handleApprovalRequired(
  input: ModeHandlerInput,
): Promise<AgentResponse> {
  if (!input.taskState.preparedPayload) {
    return handlePriceUpdatePreparation({
      ...input,
      mode: "price_update_preparation",
    });
  }

  input.taskState.approvalStatus = "pending";

  return {
    message:
      "The draft is ready. Review the diff table, then approve selected rows or all valid rows.",
    mode: input.mode,
    toolCalls: input.toolCalls,
    taskState: input.taskState,
    uiAction: {
      type: "show_approval_panel",
      payload: {
        diffRows: input.taskState.diffRows,
        preparedPayload: input.taskState.preparedPayload,
      },
    },
  };
}

/**
 * Execute an approved PMS action.
 * @param input - Mode handler input.
 * @returns Agent response.
 */
async function handleExecuteApprovedAction(
  input: ModeHandlerInput,
): Promise<AgentResponse> {
  if (!input.taskState.preparedPayload) {
    return {
      message: "There is no prepared update to execute yet.",
      mode: input.mode,
      toolCalls: input.toolCalls,
      taskState: input.taskState,
      uiAction: { type: "show_message" },
    };
  }

  if (isExplicitApproval(input.message)) {
    input.taskState.approvalStatus = "approved";
  }

  const result = await invokeTool(
    input.tools.executePriceCapacityUpsertTool,
    {},
    input.toolCalls,
  );
  input.taskState.executionResult = result as AgentTaskState["executionResult"];
  input.taskState.auditId = input.taskState.executionResult?.auditId;

  return {
    message: createExecutionSummary(input.taskState),
    mode: input.mode,
    toolCalls: input.toolCalls,
    taskState: input.taskState,
    uiAction: {
      type: "show_execution_result",
      payload: input.taskState.executionResult,
    },
  };
}

/**
 * Answer general chat using current task state.
 * @param input - Mode handler input.
 * @returns Agent response.
 */
async function handleGeneralChat(
  input: ModeHandlerInput,
): Promise<AgentResponse> {
  if (/what did you update|what changed|summary/i.test(input.message)) {
    return {
      message: createExecutionSummary(input.taskState),
      mode: input.mode,
      toolCalls: input.toolCalls,
      taskState: input.taskState,
      uiAction: { type: "show_message" },
    };
  }

  const message = await createFinalMessage(
    input.llm,
    input.mode,
    input.message,
    {
      taskState: input.taskState,
    },
  );

  return {
    message,
    mode: input.mode,
    toolCalls: input.toolCalls,
    taskState: input.taskState,
    uiAction: { type: "show_message" },
  };
}

/**
 * Invoke a LangChain tool and record the result.
 * @param langChainTool - LangChain tool.
 * @param input - Tool input.
 * @param toolCalls - Tool call log.
 * @returns Tool result.
 */
async function invokeTool(
  langChainTool: InvokableTool,
  input: unknown,
  toolCalls: ToolCallResult[],
): Promise<unknown> {
  try {
    const result = await langChainTool.invoke(input as never);
    toolCalls.push({
      name: langChainTool.name,
      status: "success",
      result,
    });
    return result;
  } catch (error) {
    const message = getErrorMessage(error);
    toolCalls.push({
      name: langChainTool.name,
      status: "error",
      error: message,
    });
    throw error;
  }
}

/**
 * Create a concise final message with LangChain.
 * @param llm - LangChain chat model.
 * @param mode - Agent mode.
 * @param userMessage - User message.
 * @param context - Tool and state context.
 * @returns Final assistant message.
 */
async function createFinalMessage(
  llm: BaseChatModel,
  mode: AgentMode,
  userMessage: string,
  context: unknown,
): Promise<string> {
  try {
    const structuredLlm = llm.withStructuredOutput(agentMessageSchema);
    const response = await structuredLlm.invoke([
      new SystemMessage(agentSystemPrompt),
      new HumanMessage(
        [
          "Write a concise response for the user.",
          "Use only the provided context. Do not invent PMS IDs, rooms, rate plans, prices, or execution results.",
          `Mode: ${mode}`,
          `User message: ${userMessage}`,
          `Context JSON: ${JSON.stringify(context)}`,
        ].join("\n"),
      ),
    ]);

    return response.message;
  } catch {
    return "I handled the request with the available tools. Review the UI panel for details.";
  }
}

/**
 * Find a hotel mentioned in the user's message.
 * @param message - User message.
 * @param hotels - Live hotel list.
 * @returns Matching hotel.
 */
function findHotelFromMessage(
  message: string,
  hotels: Hotel[],
): Hotel | undefined {
  const normalizedMessage = normalizeName(message);

  return hotels.find((hotel) => {
    const hotelName = normalizeName(hotel.name);
    return (
      normalizedMessage.includes(String(hotel.id)) ||
      normalizedMessage.includes(hotelName) ||
      hotelName.includes(normalizedMessage)
    );
  });
}

/**
 * Count array items safely.
 * @param value - Unknown result.
 * @returns Item count.
 */
function countItems(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

/**
 * Count extracted room-price rows.
 * @param extractedRateSheet - Extracted rate sheet.
 * @returns Row count.
 */
function countExtractedRows(
  extractedRateSheet: NonNullable<AgentTaskState["extractedRateSheet"]>,
): number {
  return extractedRateSheet.dateRanges.reduce(
    (total, range) => total + range.rooms.length,
    0,
  );
}

/**
 * Check whether a classified mode needs clarification.
 * @param mode - Agent mode.
 * @param taskState - Current task state.
 * @returns True when clarification is useful.
 */
function needsClarification(
  mode: AgentMode,
  taskState: AgentTaskState,
): boolean {
  return (
    (mode === "price_update_preparation" &&
      (!taskState.selectedHotel || !taskState.extractedRateSheet)) ||
    (mode === "execute_approved_action" && !taskState.preparedPayload)
  );
}

/**
 * Check whether the user explicitly approved execution.
 * @param message - User message.
 * @returns True when approval is explicit.
 */
function isExplicitApproval(message: string): boolean {
  return /approve|approved|confirm|execute|submit|تایید|اجرا/i.test(message);
}

/**
 * Create an execution summary from task state.
 * @param taskState - Current task state.
 * @returns Summary message.
 */
function createExecutionSummary(taskState: AgentTaskState): string {
  const result = taskState.executionResult;
  if (!result) {
    return "No PMS update has been executed yet.";
  }

  return `I executed the approved PMS update. Created: ${result.created}, updated: ${result.updated}, failed: ${result.failed}. Audit ID: ${result.auditId ?? taskState.auditId ?? "not available"}.`;
}

/**
 * Convert an unknown error to a user-safe message.
 * @param error - Unknown error.
 * @returns Error message.
 */
function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The agent could not complete the request.";
}
