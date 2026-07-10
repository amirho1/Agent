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
import { getServerConfig } from "../config";
import { prisma } from "../db/prisma";
import { parseJson, stringifyJson } from "../db/json";
import type {
  PreparedActionProposal,
  StructuredToolCall,
} from "../price-actions/proposal";
import {
  extractPmsActionIntent,
  type PmsActionIntent,
} from "../pms-actions/intent";
import {
  interpretPmsActionWithLlm,
  type PmsLlmIntentContext,
} from "../pms-actions/llm-intent";
import {
  prepareRoomReadResult,
  type PreparedReadResult,
} from "../pms-actions/read-result";
import {
  preparePriceOperationProposal,
  prepareRoomCreateProposal,
  prepareRoomDeactivateProposal,
  prepareRoomDeleteProposal,
  prepareRoomUpdateProposal,
} from "../pms-actions/proposal";

export async function listChats(): Promise<ChatListItem[]> {
  const chats = await prisma.chat.findMany({
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  return chats.map(serializeChat);
}

export async function createChat(message?: string): Promise<ChatDetailsDto> {
  const chat = await prisma.chat.create({
    data: {
      title: message ? createTitle(message) : "New chat",
    },
  });

  if (message?.trim()) {
    await processUserMessage(chat.id, message);
  }

  return getChatDetails(chat.id);
}

export async function getChatDetails(chatId: string): Promise<ChatDetailsDto> {
  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      uploadedFiles: { orderBy: { createdAt: "desc" } },
      agentSteps: { orderBy: [{ createdAt: "asc" }, { order: "asc" }] },
      readResults: {
        orderBy: { createdAt: "desc" },
      },
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
}

export async function processUserMessage(
  chatId: string,
  content: string,
): Promise<ChatDetailsDto> {
  const trimmedContent = content.trim();
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
      inputJson: stringifyJson({ message: trimmedContent }),
    },
  });

  try {
    await createAgentStep(chatId, agentRun.id, 1, "Understood user request");

    const config = getServerConfig();
    const intentContext = await buildPmsLlmIntentContext(chatId);
    const { result: pmsExtraction, source: intentSource } =
      await interpretPmsRequest(config, trimmedContent, intentContext);
    if (pmsExtraction.ok) {
      await createAgentStep(
        chatId,
        agentRun.id,
        2,
        `Detected action type: ${pmsExtraction.intent.type}`,
        "COMPLETED",
        {
          source: intentSource,
          intent: pmsExtraction.intent,
        },
      );

      if (isReadIntent(pmsExtraction.intent)) {
        const prepared = await prepareRoomReadResult(
          config,
          pmsExtraction.intent,
        );
        await persistPreparedSteps(chatId, agentRun.id, prepared, 3);
        await persistToolCalls(chatId, agentRun.id, prepared.toolCalls);

        const readResult = await prisma.readResult.create({
          data: {
            chatId,
            agentRunId: agentRun.id,
            type: prepared.readResult.type,
            title: prepared.readResult.title,
            summary: prepared.readResult.summary,
            hotelId:
              prepared.readResult.hotelId === undefined
                ? null
                : String(prepared.readResult.hotelId),
            matchedRowsCount: prepared.readResult.matchedRowsCount,
            columnsJson: stringifyJson(prepared.readResult.columns),
            rowsJson: stringifyJson(prepared.readResult.rows),
            toolCallsJson: stringifyJson(prepared.readResult.toolCalls),
          },
        });

        await prisma.message.create({
          data: {
            chatId,
            role: "assistant",
            content: prepared.readResult.summary,
            metadataJson: stringifyJson({
              readResultId: readResult.id,
            }),
          },
        });
        await prisma.agentRun.update({
          where: { id: agentRun.id },
          data: {
            status: "COMPLETED",
            outputJson: stringifyJson(prepared.readResult),
            completedAt: new Date(),
          },
        });

        return getChatDetails(chatId);
      }

      const prepared = await prepareProposalForIntent(
        config,
        pmsExtraction.intent,
      );
      await persistActionProposal(chatId, agentRun.id, prepared);

      return getChatDetails(chatId);
    }

    if (pmsExtraction.clarification) {
      await createAgentStep(
        chatId,
        agentRun.id,
        2,
        "Asked for missing action details",
        "WARNING",
      );

      const assistantContent = pmsExtraction.clarification;

      await prisma.message.create({
        data: {
          chatId,
          role: "assistant",
          content: assistantContent,
        },
      });
      await prisma.agentRun.update({
        where: { id: agentRun.id },
        data: {
          status: "COMPLETED",
          outputJson: stringifyJson({ message: assistantContent }),
          completedAt: new Date(),
        },
      });

      return getChatDetails(chatId);
    }

    await createAgentStep(
      chatId,
      agentRun.id,
      2,
      "No supported action detected",
      "COMPLETED",
    );

    const assistantContent =
      "I can help with confirmed PMS room and price actions. Try: Show hotel 3 cheapest 10 rooms.";

    await prisma.message.create({
      data: {
        chatId,
        role: "assistant",
        content: assistantContent,
      },
    });
    await prisma.agentRun.update({
      where: { id: agentRun.id },
      data: {
        status: "COMPLETED",
        outputJson: stringifyJson({ message: assistantContent }),
        completedAt: new Date(),
      },
    });

    return getChatDetails(chatId);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "The agent could not process this request.";

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

async function createAgentStep(
  chatId: string,
  agentRunId: string,
  order: number,
  label: string,
  status: "COMPLETED" | "WARNING" | "ERROR" = "COMPLETED",
  detail?: unknown,
) {
  return prisma.agentStep.create({
    data: {
      chatId,
      agentRunId,
      order,
      label,
      status,
      detailJson: detail === undefined ? null : stringifyJson(detail),
    },
  });
}

function isReadIntent(
  intent: PmsActionIntent,
): intent is Extract<
  PmsActionIntent,
  { type: "ROOM_LIST" | "ROOM_FILTER" | "ROOM_SORT" }
> {
  return (
    intent.type === "ROOM_LIST" ||
    intent.type === "ROOM_FILTER" ||
    intent.type === "ROOM_SORT"
  );
}

async function prepareProposalForIntent(
  config: ReturnType<typeof getServerConfig>,
  intent: PmsActionIntent,
): Promise<PreparedActionProposal> {
  switch (intent.type) {
    case "ROOM_CREATE":
      return prepareRoomCreateProposal(config, intent);
    case "ROOM_UPDATE":
      return prepareRoomUpdateProposal(config, intent);
    case "ROOM_DELETE":
      return prepareRoomDeleteProposal(config, intent);
    case "ROOM_DEACTIVATE":
      return prepareRoomDeactivateProposal(config, intent);
    case "PRICE_CAPACITY_UPDATE":
      return preparePriceOperationProposal(config, intent);
    default:
      throw new Error("Unsupported action intent.");
  }
}

async function interpretPmsRequest(
  config: ReturnType<typeof getServerConfig>,
  message: string,
  context: PmsLlmIntentContext,
): Promise<{
  result: ReturnType<typeof extractPmsActionIntent>;
  source:
    "LLM" | "LLM_WITH_DETERMINISTIC_NORMALIZATION" | "DETERMINISTIC_FALLBACK";
}> {
  const fallbackResult = extractPmsActionIntent(
    createContextualFallbackMessage(message, context),
  );

  try {
    const llmResult = await interpretPmsActionWithLlm(config, message, context);
    if (shouldPreferDeterministicClarification(fallbackResult, llmResult)) {
      return {
        result: fallbackResult,
        source: "LLM_WITH_DETERMINISTIC_NORMALIZATION",
      };
    }

    if (!llmResult.ok && fallbackResult.ok) {
      return {
        result: fallbackResult,
        source: "LLM_WITH_DETERMINISTIC_NORMALIZATION",
      };
    }

    return {
      result: llmResult,
      source: "LLM",
    };
  } catch {
    return {
      result: fallbackResult,
      source: "DETERMINISTIC_FALLBACK",
    };
  }
}

function shouldPreferDeterministicClarification(
  fallbackResult: ReturnType<typeof extractPmsActionIntent>,
  llmResult: ReturnType<typeof extractPmsActionIntent>,
): boolean {
  return (
    !fallbackResult.ok &&
    /price field/i.test(fallbackResult.clarification ?? "") &&
    llmResult.ok &&
    llmResult.intent.type === "PRICE_CAPACITY_UPDATE"
  );
}

async function buildPmsLlmIntentContext(
  chatId: string,
): Promise<PmsLlmIntentContext> {
  const [messages, latestReadResult, latestActionProposal] = await Promise.all([
    prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.readResult.findFirst({
      where: { chatId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.actionProposal.findFirst({
      where: { chatId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    messages: messages.reverse().map((message) => ({
      role: message.role,
      content: message.content,
    })),
    latestReadResult: latestReadResult
      ? {
          type: latestReadResult.type,
          title: latestReadResult.title,
          summary: latestReadResult.summary,
          hotelId: latestReadResult.hotelId,
          rows: parseJson<Record<string, unknown>[]>(
            latestReadResult.rowsJson,
            [],
          ).slice(0, 5),
        }
      : undefined,
    latestActionProposal: latestActionProposal
      ? {
          type: latestActionProposal.type,
          title: latestActionProposal.title,
          summary: latestActionProposal.summary,
          hotelId: latestActionProposal.hotelId,
          status: latestActionProposal.status,
        }
      : undefined,
  };
}

function createContextualFallbackMessage(
  message: string,
  context: PmsLlmIntentContext,
): string {
  if (/hotel\s*(?:id\s*)?\d+/i.test(message)) {
    return message;
  }

  if (
    !/\b(not|instead|rather|multiply|divide|cap|floor|set)\b/i.test(message)
  ) {
    return message;
  }

  const userMessages = context.messages.filter(
    (contextMessage) => contextMessage.role === "user",
  );
  const previousUserMessage = userMessages.at(-2)?.content;
  if (!previousUserMessage) {
    return message;
  }

  return `${previousUserMessage}. ${message}`;
}

async function persistActionProposal(
  chatId: string,
  agentRunId: string,
  prepared: PreparedActionProposal,
) {
  await persistPreparedSteps(chatId, agentRunId, prepared, 3);
  await persistToolCalls(chatId, agentRunId, prepared.toolCalls);

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
      diffsJson: stringifyJson(prepared.proposal.diffs),
      pmsPayloadJson: stringifyJson(prepared.proposal.pmsPayload),
      toolCallsJson: stringifyJson(prepared.proposal.toolCalls),
      oldValuesJson: stringifyJson(prepared.oldValues),
    },
  });

  const assistantContent =
    prepared.proposal.affectedRowsCount > 0
      ? `${prepared.proposal.summary} Review the diff table before confirming.`
      : "I could not find matching PMS rows for this request.";

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
}

async function persistPreparedSteps(
  chatId: string,
  agentRunId: string,
  prepared: Pick<PreparedActionProposal | PreparedReadResult, "steps">,
  startOrder: number,
) {
  for (const [index, step] of prepared.steps.slice(2).entries()) {
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
  diffsJson: string;
  pmsPayloadJson: string;
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
  return {
    id: proposal.id,
    type: proposal.type,
    status: proposal.status,
    title: proposal.title,
    summary: proposal.summary,
    hotelId: proposal.hotelId,
    affectedRowsCount: proposal.affectedRowsCount,
    assumptions: parseJson<string[]>(proposal.assumptionsJson, []),
    warnings: parseJson<string[]>(proposal.warningsJson, []),
    diffs: parseJson<ActionProposalDto["diffs"]>(proposal.diffsJson, []),
    pmsPayload: parseJson<ActionProposalDto["pmsPayload"]>(
      proposal.pmsPayloadJson,
      { items: [] },
    ),
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
