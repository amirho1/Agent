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
import {
  findCurrentBundlePrice,
  normalizeOldPriceValue,
} from "../lamasoo/rate-update";
import { logOperationEvent, withLoggedOperation } from "../logging";

export type ProposalConflict = {
  rowId: string;
  field: PriceField;
  expected: number | null;
  actual: number | null;
};

export async function executeConfirmedProposal(proposalId: string) {
  return withLoggedOperation("proposal.execute", { proposalId }, async () =>
    executeConfirmedProposalInner(proposalId),
  );
}

async function executeConfirmedProposalInner(proposalId: string) {
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
  logOperationEvent(
    "proposal.conflict_check",
    "proposal.conflict_check.completed",
    {
      proposalId,
      conflictCount: conflicts.length,
      conflicts,
    },
  );
  if (conflicts.length > 0) {
    return markProposalFailed(
      actionProposal.id,
      "Lamasoo data changed after the proposal was created.",
      conflicts,
    );
  }

  logOperationEvent("api.mutation", "lamasoo.price_capacity_upsert.started", {
    proposalId,
    payload,
  });
  const result = await upsertPriceCapacity(getServerConfig(), payload);
  logOperationEvent("api.mutation", "lamasoo.price_capacity_upsert.completed", {
    proposalId,
    payload,
    result,
  });
  return persistExecutionResult(
    actionProposal,
    "EXECUTED",
    { success: true, result },
    null,
    `Executed approved Lamasoo update with ${payload.items.length} item${payload.items.length === 1 ? "" : "s"}.`,
  );
}

export async function rejectProposal(proposalId: string) {
  return withLoggedOperation("proposal.reject", { proposalId }, async () =>
    rejectProposalInner(proposalId),
  );
}

async function rejectProposalInner(proposalId: string) {
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

    logOperationEvent("proposal.reject", "proposal.rejected", {
      proposalId,
      chatId: actionProposal.chatId,
      executionId: execution.id,
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
  validationIssuesJson: string;
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
    validationIssues: parseJson<AgentActionProposal["validationIssues"]>(
      actionProposal.validationIssuesJson,
      [],
    ),
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
  logOperationEvent(
    "proposal.conflict_check",
    "proposal.current_bundle.loaded",
    {
      hotelId: payload.hotelId,
      bundleId: payload.bundleId,
      oldValueCount: oldValues.length,
    },
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
    const actual = normalizeOldPriceValue(latest?.[oldValue.field]);
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
  const execution = await prisma.$transaction(async (tx) => {
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
  logOperationEvent("proposal.execute", "proposal.execution.persisted", {
    proposalId: actionProposal.id,
    chatId: actionProposal.chatId,
    status,
    result,
    error,
  });
  return execution;
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

  const execution = await prisma.$transaction(async (tx) => {
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
  logOperationEvent("proposal.execute", "proposal.execution_failed.persisted", {
    proposalId,
    chatId: actionProposal.chatId,
    error,
    conflicts,
  });
  return execution;
}
