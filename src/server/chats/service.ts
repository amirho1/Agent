import { performance } from "node:perf_hooks";
import type {
  ActionExecutionDto,
  ActionProposalDto,
  AgentStepDto,
  ChatDetailsDto,
  ChatListItem,
  ChatMessageDto,
  ReadResultDto,
  UploadedFileDto,
} from "@/src/shared/chat-types";
import type { AgentActionProposal } from "@/src/shared/agent-types";
import { getServerConfig } from "../config";
import { parseJson, stringifyJson } from "../db/json";
import { prisma } from "../db/prisma";
import {
  prepareLamasooRateUpdateProposal,
  type PreparedLamasooProposal,
  type StructuredToolCall,
} from "../lamasoo/rate-update";
import {
  getDurationMs,
  logOperationError,
  logOperationEvent,
  withLoggedOperation,
} from "../logging";

export async function listChats(): Promise<ChatListItem[]> {
  return withLoggedOperation("chat.list", { limit: 50 }, async () => {
    const chats = await prisma.chat.findMany({
      orderBy: { updatedAt: "desc" },
      take: 50,
    });

    return chats.map(serializeChat);
  });
}

export async function createChat(message?: string): Promise<ChatDetailsDto> {
  return withLoggedOperation(
    "chat.create",
    { hasInitialMessage: Boolean(message?.trim()), message },
    async () => {
      const chat = await prisma.chat.create({
        data: {
          title: message ? createTitle(message) : "New chat",
        },
      });

      logOperationEvent("chat.create", "chat.created", {
        chatId: chat.id,
        title: chat.title,
      });

      if (message?.trim()) {
        await processUserMessage(chat.id, message);
      }

      return getChatDetails(chat.id);
    },
  );
}

export async function getChatDetails(chatId: string): Promise<ChatDetailsDto> {
  return withLoggedOperation("chat.get", { chatId }, async () => {
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
        uploadedFiles: { orderBy: { createdAt: "desc" } },
        agentSteps: { orderBy: [{ createdAt: "asc" }, { order: "asc" }] },
        readResults: { orderBy: { createdAt: "desc" } },
        actionProposals: {
          orderBy: { createdAt: "desc" },
          include: {
            executions: { orderBy: { createdAt: "desc" } },
          },
        },
      },
    });

    if (!chat) {
      throw new Error("Chat was not found.");
    }

    return {
      chat: serializeChat(chat),
      messages: chat.messages.map(serializeMessage),
      uploadedFiles: chat.uploadedFiles.map(serializeUploadedFile),
      agentSteps: chat.agentSteps.map(serializeAgentStep),
      readResults: chat.readResults.map(serializeReadResult),
      actionProposals: chat.actionProposals.map(serializeActionProposal),
    };
  });
}

export async function processUserMessage(
  chatId: string,
  content: string,
): Promise<ChatDetailsDto> {
  return withLoggedOperation(
    "chat.message.process",
    { chatId, message: content },
    async () =>
      processRateUpdateText(chatId, content, content, { message: content }),
  );
}

export async function processUploadedRateSheet(
  chatId: string,
  userVisibleMessage: string,
  fileText: string,
  input: unknown,
): Promise<ChatDetailsDto> {
  return withLoggedOperation(
    "chat.uploaded_rate_sheet.process",
    { chatId, userVisibleMessage, input },
    async () =>
      processRateUpdateText(chatId, userVisibleMessage, fileText, input),
  );
}

async function processRateUpdateText(
  chatId: string,
  userVisibleMessage: string,
  sourceText: string,
  input: unknown,
): Promise<ChatDetailsDto> {
  const trimmedContent = userVisibleMessage.trim();
  if (!trimmedContent) {
    throw new Error("Message is required.");
  }

  const chat = await prisma.chat.findUnique({ where: { id: chatId } });
  if (!chat) {
    throw new Error("Chat was not found.");
  }

  const userMessage = await prisma.message.create({
    data: {
      chatId,
      role: "user",
      content: trimmedContent,
    },
  });
  logOperationEvent("agent.run", "agent.user_message.persisted", {
    chatId,
    messageId: userMessage.id,
  });

  if (chat.title === "New chat") {
    await prisma.chat.update({
      where: { id: chatId },
      data: { title: createTitle(trimmedContent) },
    });
  }

  const agentRun = await prisma.agentRun.create({
    data: {
      chatId,
      messageId: userMessage.id,
      status: "RUNNING",
      inputJson: stringifyJson(input),
    },
  });
  const config = getServerConfig();
  const agentStartedAt = performance.now();
  logOperationEvent("agent.ai_interaction", "agent.ai_interaction.started", {
    chatId,
    agentRunId: agentRun.id,
    userPrompt: sourceText,
    systemPromptVersion: "lamasoo-rate-update-v1",
    selectedModel: config.agentModel || null,
    tokenUsage: null,
  });

  try {
    await createAgentStep(
      chatId,
      agentRun.id,
      1,
      "Read user rate update request",
    );
    const prepared = await prepareLamasooRateUpdateProposal(config, sourceText);
    await persistPreparedSteps(chatId, agentRun.id, prepared, 2);
    await persistToolCalls(chatId, agentRun.id, prepared.toolCalls);
    await persistActionProposal(chatId, agentRun.id, prepared);
    logOperationEvent(
      "agent.ai_interaction",
      "agent.ai_interaction.completed",
      {
        chatId,
        agentRunId: agentRun.id,
        userPrompt: sourceText,
        systemPromptVersion: "lamasoo-rate-update-v1",
        selectedModel: config.agentModel || null,
        toolCalls: prepared.toolCalls,
        toolInputs: prepared.toolCalls.map((toolCall) => ({
          name: toolCall.name,
          input: toolCall.input,
        })),
        toolOutputs: prepared.toolCalls.map((toolCall) => ({
          name: toolCall.name,
          result: toolCall.result ?? toolCall.resultSummary,
          status: toolCall.status,
        })),
        tokenUsage: null,
        executionTimeMs: getDurationMs(agentStartedAt),
        proposal: prepared.proposal,
      },
    );

    return getChatDetails(chatId);
  } catch (error) {
    logOperationError(
      "agent.ai_interaction",
      "agent.ai_interaction.failed",
      error,
      {
        chatId,
        agentRunId: agentRun.id,
        userPrompt: sourceText,
        systemPromptVersion: "lamasoo-rate-update-v1",
        selectedModel: config.agentModel || null,
        tokenUsage: null,
        executionTimeMs: getDurationMs(agentStartedAt),
      },
    );
    const message =
      error instanceof Error
        ? error.message
        : "The Lamasoo rate update agent could not process this request.";

    await prisma.message.create({
      data: {
        chatId,
        role: "assistant",
        content: message,
      },
    });
    await prisma.agentRun.update({
      where: { id: agentRun.id },
      data: {
        status: "FAILED",
        error: message,
        completedAt: new Date(),
      },
    });

    return getChatDetails(chatId);
  }
}

async function persistActionProposal(
  chatId: string,
  agentRunId: string,
  prepared: PreparedLamasooProposal,
) {
  const actionProposal = await prisma.actionProposal.create({
    data: {
      chatId,
      agentRunId,
      type: prepared.proposal.type,
      status: "PENDING",
      title: prepared.proposal.title,
      summary: prepared.proposal.summary,
      hotelId: String(prepared.proposal.hotelId ?? ""),
      affectedRowsCount: prepared.proposal.affectedRowsCount,
      assumptionsJson: stringifyJson(prepared.proposal.assumptions),
      warningsJson: stringifyJson(prepared.proposal.warnings),
      validationIssuesJson: stringifyJson(prepared.proposal.validationIssues),
      diffsJson: stringifyJson(prepared.proposal.diffs),
      lamasooPayloadJson: stringifyJson(prepared.proposal.lamasooPayload),
      toolCallsJson: stringifyJson(prepared.proposal.toolCalls),
      oldValuesJson: stringifyJson(prepared.oldValues),
    },
  });

  const assistantContent =
    prepared.proposal.affectedRowsCount > 0
      ? `${prepared.proposal.summary} Review the Lamasoo diff table before confirming.`
      : `${prepared.proposal.summary} No Lamasoo update will run until the issues are resolved.`;

  await prisma.message.create({
    data: {
      chatId,
      role: "assistant",
      content: assistantContent,
      metadataJson: stringifyJson({
        proposalId: actionProposal.id,
      }),
    },
  });
  await prisma.agentRun.update({
    where: { id: agentRunId },
    data: {
      status: "COMPLETED",
      outputJson: stringifyJson(prepared.proposal),
      completedAt: new Date(),
    },
  });
  logOperationEvent("proposal.generate", "proposal.generated", {
    chatId,
    agentRunId,
    proposalId: actionProposal.id,
    type: prepared.proposal.type,
    affectedRowsCount: prepared.proposal.affectedRowsCount,
    warnings: prepared.proposal.warnings,
  });
}

async function createAgentStep(
  chatId: string,
  agentRunId: string,
  order: number,
  label: string,
  status: "COMPLETED" | "WARNING" | "ERROR" = "COMPLETED",
  detail?: unknown,
) {
  const agentStep = await prisma.agentStep.create({
    data: {
      chatId,
      agentRunId,
      order,
      label,
      status,
      detailJson: detail === undefined ? null : stringifyJson(detail),
    },
  });
  logOperationEvent("agent.step", "agent.step.persisted", {
    chatId,
    agentRunId,
    order,
    label,
    status,
    detail,
  });
  return agentStep;
}

async function persistPreparedSteps(
  chatId: string,
  agentRunId: string,
  prepared: Pick<PreparedLamasooProposal, "steps">,
  startOrder: number,
) {
  for (const [index, step] of prepared.steps.entries()) {
    await createAgentStep(
      chatId,
      agentRunId,
      index + startOrder,
      step.label,
      step.status ?? "COMPLETED",
      step.detail,
    );
  }
}

async function persistToolCalls(
  chatId: string,
  agentRunId: string,
  toolCalls: StructuredToolCall[],
) {
  for (const toolCall of toolCalls) {
    await prisma.toolCall.create({
      data: {
        chatId,
        agentRunId,
        name: toolCall.name,
        inputJson: stringifyJson(toolCall.input),
        resultSummary: toolCall.resultSummary,
        resultJson: stringifyJson(toolCall.result ?? null),
        status: toolCall.status,
        error: toolCall.error,
      },
    });
    logOperationEvent("agent.tool_call", "agent.tool_call.persisted", {
      chatId,
      agentRunId,
      toolCall,
    });
  }
}

function serializeChat(chat: {
  id: string;
  title: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): ChatListItem {
  return {
    id: chat.id,
    title: chat.title,
    status: chat.status,
    createdAt: chat.createdAt.toISOString(),
    updatedAt: chat.updatedAt.toISOString(),
  };
}

function serializeMessage(message: {
  id: string;
  role: string;
  content: string;
  metadataJson: string | null;
  createdAt: Date;
}): ChatMessageDto {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    metadata: parseJson<unknown>(message.metadataJson, undefined),
    createdAt: message.createdAt.toISOString(),
  };
}

function serializeUploadedFile(file: {
  id: string;
  fileName: string;
  contentType: string;
  size: number;
  createdAt: Date;
}): UploadedFileDto {
  return {
    id: file.id,
    fileName: file.fileName,
    contentType: file.contentType,
    size: file.size,
    createdAt: file.createdAt.toISOString(),
  };
}

function serializeAgentStep(step: {
  id: string;
  label: string;
  status: string;
  detailJson: string | null;
  order: number;
  createdAt: Date;
}): AgentStepDto {
  return {
    id: step.id,
    label: step.label,
    status: step.status,
    detail: parseJson<unknown>(step.detailJson, undefined),
    order: step.order,
    createdAt: step.createdAt.toISOString(),
  };
}

function serializeReadResult(result: {
  id: string;
  type: string;
  title: string;
  summary: string;
  hotelId: string | null;
  matchedRowsCount: number;
  columnsJson: string;
  rowsJson: string;
  toolCallsJson: string;
  createdAt: Date;
}): ReadResultDto {
  return {
    id: result.id,
    type: result.type as ReadResultDto["type"],
    title: result.title,
    summary: result.summary,
    hotelId: result.hotelId,
    matchedRowsCount: result.matchedRowsCount,
    columns: parseJson<string[]>(result.columnsJson, []),
    rows: parseJson<Record<string, unknown>[]>(result.rowsJson, []),
    toolCalls: parseJson<ReadResultDto["toolCalls"]>(result.toolCallsJson, []),
    createdAt: result.createdAt.toISOString(),
  };
}

function serializeActionProposal(proposal: {
  id: string;
  type: string;
  status: string;
  title: string;
  summary: string;
  hotelId: string;
  affectedRowsCount: number;
  assumptionsJson: string;
  warningsJson: string;
  validationIssuesJson: string;
  diffsJson: string;
  lamasooPayloadJson: string;
  createdAt: Date;
  updatedAt: Date;
  executions: Array<{
    id: string;
    status: string;
    resultJson: string | null;
    conflictJson: string | null;
    error: string | null;
    createdAt: Date;
  }>;
}): ActionProposalDto {
  const lamasooPayload = parseJson<AgentActionProposal["lamasooPayload"]>(
    proposal.lamasooPayloadJson,
    { hotelId: "", items: [] },
  );

  return {
    id: proposal.id,
    type: proposal.type,
    status: proposal.status,
    title: proposal.title,
    summary: proposal.summary,
    hotelId: proposal.hotelId,
    bundleId: lamasooPayload.bundleId,
    affectedRowsCount: proposal.affectedRowsCount,
    assumptions: parseJson<string[]>(proposal.assumptionsJson, []),
    warnings: parseJson<string[]>(proposal.warningsJson, []),
    validationIssues: parseJson<ActionProposalDto["validationIssues"]>(
      proposal.validationIssuesJson,
      [],
    ),
    diffs: parseJson<ActionProposalDto["diffs"]>(proposal.diffsJson, []),
    lamasooPayload,
    createdAt: proposal.createdAt.toISOString(),
    updatedAt: proposal.updatedAt.toISOString(),
    executions: proposal.executions.map(serializeActionExecution),
  };
}

function serializeActionExecution(execution: {
  id: string;
  status: string;
  resultJson: string | null;
  conflictJson: string | null;
  error: string | null;
  createdAt: Date;
}): ActionExecutionDto {
  return {
    id: execution.id,
    status: execution.status,
    result: parseJson<unknown>(execution.resultJson, undefined),
    conflict: parseJson<unknown>(execution.conflictJson, undefined),
    error: execution.error,
    createdAt: execution.createdAt.toISOString(),
  };
}

function createTitle(message: string): string {
  return message.trim().replace(/\s+/g, " ").slice(0, 60) || "New chat";
}
