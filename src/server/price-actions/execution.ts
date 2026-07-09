import type {
  AgentActionProposal,
  PreparedPriceCapacityPayload,
  PriceCapacityRecord,
  StoredProposalOldValue,
} from "@/src/shared/agent-types";
import { prisma } from "../db/prisma";
import { parseJson, stringifyJson } from "../db/json";
import {
  getPriceCapacityRows,
  upsertPriceCapacity,
} from "../dummy-pms/client";
import { getServerConfig } from "../config";
import { agentActionProposalSchema } from "./schemas";
import { buildRowId } from "./proposal";

export type ProposalConflict = {
  rowId: string;
  field: "boardPrice" | "displayPrice";
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

  const proposal = agentActionProposalSchema.parse({
    type: actionProposal.type,
    status: "PENDING_CONFIRMATION",
    title: actionProposal.title,
    summary: actionProposal.summary,
    hotelId: actionProposal.hotelId,
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
    pmsPayload: parseJson<AgentActionProposal["pmsPayload"]>(
      actionProposal.pmsPayloadJson,
      { items: [] },
    ),
  });
  const oldValues = parseJson<StoredProposalOldValue[]>(
    actionProposal.oldValuesJson,
    [],
  );

  if (proposal.pmsPayload.items.length === 0 || oldValues.length === 0) {
    const execution = await markProposalFailed(
      proposalId,
      "No executable PMS payload is available.",
      [],
    );
    return execution;
  }

  const latestRows = await getLatestRows(String(proposal.hotelId), oldValues);
  const conflicts = findConflicts(oldValues, latestRows);
  if (conflicts.length > 0) {
    return markProposalFailed(
      proposalId,
      "PMS data changed after the proposal was created.",
      conflicts,
    );
  }

  const result = await upsertPriceCapacity(getServerConfig(), {
    hotelId: proposal.hotelId,
    items: proposal.pmsPayload.items,
  } satisfies PreparedPriceCapacityPayload);

  return prisma.$transaction(async (tx) => {
    const execution = await tx.actionExecution.create({
      data: {
        actionProposalId: proposalId,
        status: result.success ? "EXECUTED" : "FAILED",
        resultJson: stringifyJson(result),
        error: result.success ? null : result.errors.join("; "),
      },
    });

    await tx.actionProposal.update({
      where: { id: proposalId },
      data: {
        status: result.success ? "EXECUTED" : "FAILED",
      },
    });

    await tx.message.create({
      data: {
        chatId: actionProposal.chatId,
        role: "assistant",
        content: result.success
          ? `Executed approved PMS update. Created: ${result.created}, updated: ${result.updated}, failed: ${result.failed}.`
          : `PMS update failed. ${result.errors.join("; ")}`,
        metadataJson: stringifyJson({
          proposalId,
          executionId: execution.id,
        }),
      },
    });

    return execution;
  });
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
          message: "User rejected the proposal. No PMS data changed.",
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
        content: "Rejected the proposal. No PMS data changed.",
        metadataJson: stringifyJson({
          proposalId,
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
            ? "Execution stopped because PMS data changed after the proposal was created."
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

async function getLatestRows(
  hotelId: string,
  oldValues: StoredProposalOldValue[],
): Promise<PriceCapacityRecord[]> {
  const dates = oldValues.map((value) => value.date).sort();
  return getPriceCapacityRows(getServerConfig(), {
    hotelId,
    from: dates[0],
    to: dates[dates.length - 1],
  });
}

function findConflicts(
  oldValues: StoredProposalOldValue[],
  latestRows: PriceCapacityRecord[],
): ProposalConflict[] {
  const latestById = new Map(latestRows.map((row) => [buildRowId(row), row]));
  const conflicts: ProposalConflict[] = [];

  for (const oldValue of oldValues) {
    const latest = latestById.get(oldValue.rowId);
    const latestBoardPrice = normalizeNullableNumber(
      latest?.price?.boardPrice,
    );
    const latestDisplayPrice = normalizeNullableNumber(
      latest?.price?.displayPrice,
    );

    if (latestBoardPrice !== oldValue.boardPrice) {
      conflicts.push({
        rowId: oldValue.rowId,
        field: "boardPrice",
        expected: oldValue.boardPrice,
        actual: latestBoardPrice,
      });
    }

    if (latestDisplayPrice !== oldValue.displayPrice) {
      conflicts.push({
        rowId: oldValue.rowId,
        field: "displayPrice",
        expected: oldValue.displayPrice,
        actual: latestDisplayPrice,
      });
    }
  }

  return conflicts;
}

function normalizeNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
