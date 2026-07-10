import type {
  AgentActionProposal,
  PreparedPriceCapacityPayload,
  PriceCapacityRecord,
  RoomActionPmsPayload,
  RoomTypeProvider,
  StoredProposalOldValue,
} from "@/src/shared/agent-types";
import { prisma } from "../db/prisma";
import { parseJson, stringifyJson } from "../db/json";
import {
  executeCreateRoom,
  executeDeactivateRoom,
  executeDeleteRoom,
  executeUpdateRoom,
  getPriceCapacityRows,
  getRoomById,
  upsertPriceCapacity,
} from "../dummy-pms/client";
import { getServerConfig } from "../config";
import { agentActionProposalSchema } from "./schemas";
import { buildRowId } from "./proposal";

export type ProposalConflict = {
  rowId: string;
  field: string;
  expected: string | number | boolean | null;
  actual: string | number | boolean | null;
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

  if (isPriceProposal(proposal)) {
    return executePriceProposal(actionProposal, proposal, oldValues);
  }

  return executeRoomProposal(actionProposal, proposal, oldValues);
}

async function executePriceProposal(
  actionProposal: { id: string; chatId: string },
  proposal: AgentActionProposal,
  oldValues: StoredProposalOldValue[],
) {
  const pricePayload = getPricePayload(proposal.pmsPayload);
  const priceOldValues = oldValues.filter(isPriceOldValue);

  if (proposal.hotelId === undefined) {
    return markProposalFailed(
      actionProposal.id,
      "No hotel ID is available for this PMS price update.",
      [],
    );
  }

  if (!pricePayload || pricePayload.items.length === 0 || priceOldValues.length === 0) {
    const execution = await markProposalFailed(
      actionProposal.id,
      "No executable PMS payload is available.",
      [],
    );
    return execution;
  }

  const latestRows = await getLatestRows(String(proposal.hotelId), priceOldValues);
  const conflicts = findConflicts(priceOldValues, latestRows);
  if (conflicts.length > 0) {
    return markProposalFailed(
      actionProposal.id,
      "PMS data changed after the proposal was created.",
      conflicts,
    );
  }

  const result = await upsertPriceCapacity(getServerConfig(), {
    hotelId: proposal.hotelId,
    items: pricePayload.items,
  } satisfies PreparedPriceCapacityPayload);

  return persistExecutionResult(
    actionProposal,
    result.success ? "EXECUTED" : "FAILED",
    result,
    result.success ? null : result.errors.join("; "),
    result.success
      ? `Executed approved PMS update. Created: ${result.created}, updated: ${result.updated}, failed: ${result.failed}.`
      : `PMS update failed. ${result.errors.join("; ")}`,
  );
}

async function executeRoomProposal(
  actionProposal: { id: string; chatId: string },
  proposal: AgentActionProposal,
  oldValues: StoredProposalOldValue[],
) {
  const conflicts = await findRoomConflicts(oldValues);
  if (conflicts.length > 0) {
    return markProposalFailed(
      actionProposal.id,
      "PMS room data changed after the proposal was created.",
      conflicts,
    );
  }

  const payloads = getRoomPayloads(proposal.pmsPayload);
  if (payloads.length === 0) {
    return markProposalFailed(
      actionProposal.id,
      "No executable PMS room payload is available.",
      [],
    );
  }

  const results = [];
  for (const payload of payloads) {
    results.push(await executeRoomPayload(payload));
  }

  const result = {
    success: true,
    affected: results.length,
    items: results,
  };

  return persistExecutionResult(
    actionProposal,
    "EXECUTED",
    result,
    null,
    `Executed approved PMS room action. Affected: ${results.length}.`,
  );
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
      data: {
        status,
      },
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

function isPriceProposal(proposal: AgentActionProposal): boolean {
  return (
    proposal.type === "PRICE_CAPACITY_UPDATE" ||
    proposal.type === "PRICE_CAPACITY_UPSERT"
  );
}

function getPricePayload(
  payload: AgentActionProposal["pmsPayload"],
): { items: PreparedPriceCapacityPayload["items"] } | null {
  if (!("items" in payload) || !Array.isArray(payload.items)) {
    return null;
  }

  if (payload.items.some((item) => "action" in item)) {
    return null;
  }

  return {
    items: payload.items as PreparedPriceCapacityPayload["items"],
  };
}

function getRoomPayloads(
  payload: AgentActionProposal["pmsPayload"],
): RoomActionPmsPayload[] {
  if ("action" in payload) {
    return [payload];
  }

  if ("items" in payload && Array.isArray(payload.items)) {
    return payload.items.filter((item): item is RoomActionPmsPayload => {
      return typeof item === "object" && item !== null && "action" in item;
    });
  }

  return [];
}

async function executeRoomPayload(payload: RoomActionPmsPayload) {
  const config = getServerConfig();

  switch (payload.action) {
    case "CREATE_ROOM":
      return executeCreateRoom(config, payload.hotelId, payload.room);
    case "UPDATE_ROOM":
      return executeUpdateRoom(
        config,
        payload.hotelId,
        payload.roomId,
        payload.update,
      );
    case "DEACTIVATE_ROOM":
      return executeDeactivateRoom(config, payload.hotelId, payload.roomId);
    case "DELETE_ROOM":
      return executeDeleteRoom(config, payload.hotelId, payload.roomId);
    default:
      throw new Error("Unsupported room action payload.");
  }
}

async function findRoomConflicts(
  oldValues: StoredProposalOldValue[],
): Promise<ProposalConflict[]> {
  const conflicts: ProposalConflict[] = [];

  for (const oldValue of oldValues) {
    if (oldValue.entityType !== "ROOM") {
      continue;
    }

    const latest = await readLatestRoom(oldValue.hotelId, oldValue.roomId);
    for (const [field, expected] of Object.entries(oldValue.values)) {
      const actual = latest ? normalizeDiffValue(latest[field]) : null;
      if (actual !== expected) {
        conflicts.push({
          rowId: oldValue.rowId,
          field,
          expected,
          actual,
        });
      }
    }
  }

  return conflicts;
}

async function readLatestRoom(
  hotelId: string | number,
  roomId: string | number,
): Promise<RoomTypeProvider | null> {
  try {
    return await getRoomById(getServerConfig(), hotelId, roomId);
  } catch {
    return null;
  }
}

async function getLatestRows(
  hotelId: string,
  oldValues: Array<Extract<StoredProposalOldValue, { entityType?: "PRICE_CAPACITY" }>>,
): Promise<PriceCapacityRecord[]> {
  const dates = oldValues.map((value) => value.date).sort();
  return getPriceCapacityRows(getServerConfig(), {
    hotelId,
    from: dates[0],
    to: dates[dates.length - 1],
  });
}

function findConflicts(
  oldValues: Array<Extract<StoredProposalOldValue, { entityType?: "PRICE_CAPACITY" }>>,
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
    const latestPayablePrice = normalizeNullableNumber(
      latest?.price?.payablePrice,
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

    if (
      oldValue.payablePrice !== undefined &&
      latestPayablePrice !== oldValue.payablePrice
    ) {
      conflicts.push({
        rowId: oldValue.rowId,
        field: "payablePrice",
        expected: oldValue.payablePrice,
        actual: latestPayablePrice,
      });
    }
  }

  return conflicts;
}

function isPriceOldValue(
  value: StoredProposalOldValue,
): value is Extract<StoredProposalOldValue, { entityType?: "PRICE_CAPACITY" }> {
  return value.entityType !== "ROOM";
}

function normalizeNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeDiffValue(
  value: unknown,
): string | number | boolean | null {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  return null;
}
