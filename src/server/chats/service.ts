import type {
  ActionExecutionDto,
  ActionProposalDto,
  AgentStepDto,
  ChatDetailsDto,
  ChatListItem,
  ChatMessageDto,
  UploadedFileDto,
} from "@/src/shared/chat-types";
import { getServerConfig } from "../config";
import { prisma } from "../db/prisma";
import { parseJson, stringifyJson } from "../db/json";
import { extractPriceUpdateIntent } from "../price-actions/intent";
import { preparePercentagePriceProposal } from "../price-actions/proposal";

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

    const extraction = extractPriceUpdateIntent(trimmedContent);
    if (!extraction.ok) {
      await createAgentStep(
        chatId,
        agentRun.id,
        2,
        extraction.isPriceUpdateRequest
          ? "Asked for missing action details"
          : "No supported action detected",
        extraction.isPriceUpdateRequest ? "WARNING" : "COMPLETED",
      );

      const assistantContent =
        extraction.clarification ??
        "I can help with confirmed PMS price updates. Try: Increase room prices by 10% for hotel 1.";

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
      "Detected action type: update room prices",
      "COMPLETED",
      extraction.intent,
    );

    const prepared = await preparePercentagePriceProposal(
      getServerConfig(),
      extraction.intent,
    );

    for (const [index, step] of prepared.steps.entries()) {
      await createAgentStep(
        chatId,
        agentRun.id,
        index + 3,
        step.label,
        step.status ?? "COMPLETED",
        step.detail,
      );
    }

    for (const toolCall of prepared.toolCalls) {
      await prisma.toolCall.create({
        data: {
          chatId,
          agentRunId: agentRun.id,
          name: toolCall.name,
          inputJson: stringifyJson(toolCall.input),
          resultSummary: toolCall.resultSummary,
          resultJson: stringifyJson(toolCall.result ?? null),
          status: toolCall.status,
          error: toolCall.error,
        },
      });
    }

    const actionProposal = await prisma.actionProposal.create({
      data: {
        chatId,
        agentRunId: agentRun.id,
        type: prepared.proposal.type,
        status: "PENDING",
        title: prepared.proposal.title,
        summary: prepared.proposal.summary,
        hotelId: String(prepared.proposal.hotelId),
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
      where: { id: agentRun.id },
      data: {
        status: "COMPLETED",
        outputJson: stringifyJson(prepared.proposal),
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

function serializeActionProposal(
  proposal: {
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
  },
): ActionProposalDto {
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
