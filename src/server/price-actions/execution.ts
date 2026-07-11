import type {
  AgentActionProposal,
  LamasooPriceCapacityPayload,
  PriceField,
  StoredProposalOldValue,
} from "@/src/shared/agent-types";
import { prisma } from "../db/prisma";
import { parseJson, stringifyJson } from "../db/json";
import { getServerConfig } from "../config";
import { getBundle, upsertPriceCapacity } from "../lamasoo/client";
import { findCurrentBundlePrice } from "../lamasoo/rate-update";

export type ProposalConflict = {
  rowId: string;
  field: PriceField;
  expected: number | null;
  actual: number | null;
};

export async function executeConfirmedProposal(proposalId: string) {
  const actionProposal = await prisma.actionProposal.findUnique({
    where: { id: proposalId },
  });

  if (!actionProposal) {
    throw new Error("Action proposal was not found.");
  }

  if (actionProposal.status !== "PENDING") {
    throw new Error(`Proposal is ${actionProposal.status} and cannot execute.`);
  }

  const proposal = parseStoredProposal(actionProposal);
  if (proposal.type !== "LAMASOO_RATE_PLAN_PRICE_UPDATE") {
    throw new Error("Only Lamasoo rate-plan price proposals are supported.");
  }

  const payload = proposal.lamasooPayload;
  if (!payload.items.length || !proposal.hotelId || !proposal.bundleId) {
    return markProposalFailed(
      actionProposal.id,
      "No executable Lamasoo payload is available.",
      [],
    );
  }

  const oldValues = parseJson<StoredProposalOldValue[]>(
    actionProposal.oldValuesJson,
    [],
  );
  const conflicts = await findConflicts(payload, oldValues);
  if (conflicts.length > 0) {
    return markProposalFailed(
      actionProposal.id,
      "Lamasoo data changed after the proposal was created.",
      conflicts,
    );
  }

  const result = await upsertPriceCapacity(getServerConfig(), payload);
  return persistExecutionResult(
    actionProposal,
    "EXECUTED",
    { success: true, result },
    null,
    `Executed approved Lamasoo update with ${payload.items.length} item${payload.items.length === 1 ? "" : "s"}.`,
  );
}

export async function rejectProposal(proposalId: string) {
  const actionProposal = await prisma.actionProposal.findUnique({
    where: { id: proposalId },
  });

  if (!actionProposal) {
    throw new Error("Action proposal was not found.");
  }

  if (actionProposal.status !== "PENDING") {
    throw new Error(`Proposal is ${actionProposal.status} and cannot reject.`);
  }

  return prisma.$transaction(async (tx) => {
    const execution = await tx.actionExecution.create({
      data: {
        actionProposalId: proposalId,
        status: "REJECTED",
        resultJson: stringifyJson({
          success: true,
          message: "User rejected the proposal. No Lamasoo data changed.",
        }),
      },
    });

    await tx.actionProposal.update({
      where: { id: proposalId },
      data: { status: "REJECTED" },
    });

    await tx.message.create({
      data: {
        chatId: actionProposal.chatId,
        role: "assistant",
        content: "Rejected the proposal. No Lamasoo data changed.",
        metadataJson: stringifyJson({
          proposalId,
          executionId: execution.id,
        }),
      },
    });

    return execution;
  });
}

function parseStoredProposal(actionProposal: {
  type: string;
  title: string;
  summary: string;
  hotelId: string;
  affectedRowsCount: number;
  assumptionsJson: string;
  warningsJson: string;
  toolCallsJson: string;
  diffsJson: string;
  lamasooPayloadJson: string;
}): AgentActionProposal {
  const payload = parseJson<LamasooPriceCapacityPayload>(
    actionProposal.lamasooPayloadJson,
    { hotelId: "", items: [] },
  );

  return {
    type: actionProposal.type as AgentActionProposal["type"],
    status: "PENDING_CONFIRMATION",
    title: actionProposal.title,
    summary: actionProposal.summary,
    hotelId: actionProposal.hotelId,
    bundleId: payload.bundleId,
    affectedRowsCount: actionProposal.affectedRowsCount,
    assumptions: parseJson<string[]>(actionProposal.assumptionsJson, []),
    warnings: parseJson<string[]>(actionProposal.warningsJson, []),
    toolCalls: parseJson<AgentActionProposal["toolCalls"]>(
      actionProposal.toolCallsJson,
      [],
    ),
    diffs: parseJson<AgentActionProposal["diffs"]>(
      actionProposal.diffsJson,
      [],
    ),
    lamasooPayload: payload,
  };
}

async function findConflicts(
  payload: LamasooPriceCapacityPayload,
  oldValues: StoredProposalOldValue[],
): Promise<ProposalConflict[]> {
  if (!payload.bundleId) {
    return [];
  }

  const bundle = await getBundle(
    getServerConfig(),
    payload.hotelId,
    payload.bundleId,
  );
  const conflicts: ProposalConflict[] = [];

  for (const oldValue of oldValues) {
    if (oldValue.value === null) {
      continue;
    }

    const latest = findCurrentBundlePrice(
      bundle,
      oldValue.roomTypeProviderId,
      oldValue.ratePlanId,
    );
    const actual = latest?.[oldValue.field] ?? null;
    if (actual !== oldValue.value) {
      conflicts.push({
        rowId: oldValue.rowId,
        field: oldValue.field,
        expected: oldValue.value,
        actual,
      });
    }
  }

  return conflicts;
}

async function persistExecutionResult(
  actionProposal: { id: string; chatId: string },
  status: "EXECUTED" | "FAILED",
  result: unknown,
  error: string | null,
  content: string,
) {
  return prisma.$transaction(async (tx) => {
    const execution = await tx.actionExecution.create({
      data: {
        actionProposalId: actionProposal.id,
        status,
        resultJson: stringifyJson(result),
        error,
      },
    });

    await tx.actionProposal.update({
      where: { id: actionProposal.id },
      data: { status },
    });

    await tx.message.create({
      data: {
        chatId: actionProposal.chatId,
        role: "assistant",
        content,
        metadataJson: stringifyJson({
          proposalId: actionProposal.id,
          executionId: execution.id,
        }),
      },
    });

    return execution;
  });
}

async function markProposalFailed(
  proposalId: string,
  error: string,
  conflicts: ProposalConflict[],
) {
  const actionProposal = await prisma.actionProposal.findUnique({
    where: { id: proposalId },
  });

  if (!actionProposal) {
    throw new Error("Action proposal was not found.");
  }

  return prisma.$transaction(async (tx) => {
    const execution = await tx.actionExecution.create({
      data: {
        actionProposalId: proposalId,
        status: "FAILED",
        error,
        conflictJson: stringifyJson(conflicts),
      },
    });

    await tx.actionProposal.update({
      where: { id: proposalId },
      data: { status: "FAILED" },
    });

    await tx.message.create({
      data: {
        chatId: actionProposal.chatId,
        role: "assistant",
        content:
          conflicts.length > 0
            ? "Execution stopped because Lamasoo data changed after the proposal was created."
            : error,
        metadataJson: stringifyJson({
          proposalId,
          executionId: execution.id,
          conflicts,
        }),
      },
    });

    return execution;
  });
}
