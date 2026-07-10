import type {
  AgentActionProposal,
  PriceCapacityRecord,
  PriceUpdateIntent,
  StoredProposalOldValue,
} from "@/src/shared/agent-types";
import type { ServerConfig } from "../config";
import {
  getPriceCapacityRows,
  listChildrenCategories,
  listRatePlans,
  listRoomTypes,
  type PriceCapacityRowFilters,
} from "../dummy-pms/client";
import { agentActionProposalSchema } from "./schemas";

export type StructuredAgentStep = {
  label: string;
  status?: "COMPLETED" | "WARNING" | "ERROR";
  detail?: unknown;
};

export type StructuredToolCall = {
  name: string;
  input: unknown;
  resultSummary: string;
  result?: unknown;
  status: "SUCCESS" | "ERROR";
  error?: string;
};

export type PreparedActionProposal = {
  proposal: AgentActionProposal;
  oldValues: StoredProposalOldValue[];
  steps: StructuredAgentStep[];
  toolCalls: StructuredToolCall[];
};

export async function preparePercentagePriceProposal(
  config: ServerConfig,
  intent: PriceUpdateIntent,
): Promise<PreparedActionProposal> {
  const steps: StructuredAgentStep[] = [
    { label: "Understood user request" },
    { label: "Detected action type: update room prices" },
  ];
  const toolCalls: StructuredToolCall[] = [];

  const [roomTypes, ratePlans, childrenCategories] = await Promise.all([
    recordToolCall(
      toolCalls,
      "getHotelRooms",
      { hotelId: intent.hotelId },
      () => listRoomTypes(config, intent.hotelId),
      (result) => `Fetched ${result.length} rooms from PMS`,
    ),
    recordToolCall(
      toolCalls,
      "getRatePlans",
      { hotelId: intent.hotelId },
      () => listRatePlans(config, intent.hotelId),
      (result) => `Fetched ${result.length} rate plans from PMS`,
    ),
    recordToolCall(
      toolCalls,
      "getChildrenCategories",
      { hotelId: intent.hotelId },
      () => listChildrenCategories(config, intent.hotelId),
      (result) => `Fetched ${result.length} children categories from PMS`,
    ),
  ]);

  steps.push({ label: `Fetched ${roomTypes.length} rooms from PMS` });

  const pmsFilters = buildPmsFilters(intent);
  const rows = await recordToolCall(
    toolCalls,
    "getPriceCapacityRows",
    pmsFilters,
    () => getPriceCapacityRows(config, pmsFilters),
    (result) => `Fetched ${result.length} price-capacity rows from PMS`,
  );

  steps.push({ label: `Fetched ${rows.length} price-capacity rows from PMS` });

  const roomNameById = new Map(
    roomTypes.map((room) => [String(room.id), room.name]),
  );
  const ratePlanById = new Map(ratePlans.map((plan) => [String(plan.id), plan]));
  const assumptions = createAssumptions(intent);
  const warnings: string[] = [];

  if (intent.priceFilters.length > 0) {
    warnings.push(
      "Currency was not converted; numeric PMS price filters were applied exactly as requested.",
    );
  }

  if (childrenCategories.length === 0) {
    warnings.push("No children categories were returned by PMS for this hotel.");
  }

  const validRows = rows.filter((row) => {
    if (!row.price?.ratePlanId) {
      warnings.push(
        `Skipped ${row.date}/${row.roomTypeProviderId}: missing ratePlanId.`,
      );
      return false;
    }

    if (
      intent.roomTypeProviderId &&
      Number(row.roomTypeProviderId) !== intent.roomTypeProviderId
    ) {
      return false;
    }

    if (intent.ratePlanId && Number(row.price.ratePlanId) !== intent.ratePlanId) {
      return false;
    }

    if (intent.roomName) {
      const roomName = roomNameById.get(String(row.roomTypeProviderId)) ?? "";
      if (!normalizeSearchText(roomName).includes(normalizeSearchText(intent.roomName))) {
        return false;
      }
    }

    return true;
  });

  const diffs: AgentActionProposal["diffs"] = [];
  const oldValues: StoredProposalOldValue[] = [];
  const pmsPayloadItems = validRows.map((row) => {
    const ratePlanId = Number(row.price?.ratePlanId);
    const roomTypeProviderId = Number(row.roomTypeProviderId);
    const oldBoardPrice = normalizeNullableNumber(row.price?.boardPrice);
    const oldDisplayPrice = normalizeNullableNumber(row.price?.displayPrice);
    const newBoardPrice =
      oldBoardPrice === null
        ? undefined
        : calculatePercentageChange(
            oldBoardPrice,
            intent.percent,
            intent.direction,
          );
    const newDisplayPrice =
      oldDisplayPrice === null
        ? undefined
        : calculatePercentageChange(
            oldDisplayPrice,
            intent.percent,
            intent.direction,
          );
    const rowId = buildRowId(row);
    const roomName = roomNameById.get(String(row.roomTypeProviderId));

    oldValues.push({
      entityType: "PRICE_CAPACITY",
      rowId,
      date: row.date,
      roomTypeProviderId,
      ratePlanId,
      boardPrice: oldBoardPrice,
      displayPrice: oldDisplayPrice,
    });

    if (newBoardPrice !== undefined) {
      diffs.push({
        action: "UPDATE",
        entityType: "PRICE_CAPACITY",
        rowId,
        roomTypeProviderId,
        roomName,
        date: row.date,
        ratePlanId,
        field: "boardPrice",
        oldValue: oldBoardPrice,
        newValue: newBoardPrice,
      });
    }

    if (newDisplayPrice !== undefined) {
      diffs.push({
        action: "UPDATE",
        entityType: "PRICE_CAPACITY",
        rowId,
        roomTypeProviderId,
        roomName,
        date: row.date,
        ratePlanId,
        field: "displayPrice",
        oldValue: oldDisplayPrice,
        newValue: newDisplayPrice,
      });
    }

    return {
      date: row.date,
      roomTypeProviderId,
      count: row.count,
      constraint: row.constraint,
      price: {
        ratePlanId,
        boardPrice: newBoardPrice ?? row.price?.boardPrice,
        displayPrice: newDisplayPrice ?? row.price?.displayPrice,
        payablePrice: row.price?.payablePrice,
        extraGuestPrice: row.price?.extraGuestPrice,
        childrenPrices: row.price?.childrenPrices,
      },
    };
  });

  if (validRows.length === 0) {
    warnings.push("No matching PMS price-capacity rows were found.");
  }

  steps.push({
    label: `Calculated ${diffs.length} proposed field updates`,
  });
  steps.push({ label: "Waiting for user confirmation" });

  const title = `${capitalize(intent.direction)} room prices by ${intent.percent}%`;
  const proposal = agentActionProposalSchema.parse({
    type: "PRICE_CAPACITY_UPDATE",
    status: "PENDING_CONFIRMATION",
    title,
    summary: `${title} for hotel ${intent.hotelId}. ${validRows.length} PMS rows are affected.`,
    hotelId: intent.hotelId,
    affectedRowsCount: validRows.length,
    assumptions,
    warnings,
    toolCalls: toolCalls.map((toolCall) => ({
      name: toolCall.name,
      input: toolCall.input,
      resultSummary: toolCall.resultSummary,
    })),
    diffs,
    pmsPayload: {
      items: pmsPayloadItems,
    },
  });

  return {
    proposal,
    oldValues,
    steps,
    toolCalls,
  };
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function buildRowId(row: PriceCapacityRecord): string {
  return [row.date, row.roomTypeProviderId, row.price?.ratePlanId].join(":");
}

export function calculatePercentageChange(
  value: number,
  percent: number,
  direction: PriceUpdateIntent["direction"],
): number {
  const multiplier =
    direction === "increase" ? 1 + percent / 100 : 1 - percent / 100;
  return Math.max(1, Math.round(value * multiplier));
}

function buildPmsFilters(intent: PriceUpdateIntent): PriceCapacityRowFilters {
  const filters: PriceCapacityRowFilters = {
    hotelId: intent.hotelId,
    from: intent.from,
    to: intent.to,
    roomTypeProviderId: intent.roomTypeProviderId,
    ratePlanId: intent.ratePlanId,
  };

  for (const filter of intent.priceFilters) {
    const key = `${filter.field}${capitalizeFilterOperator(
      filter.operator,
    )}` as keyof PriceCapacityRowFilters;
    filters[key] = filter.value as never;
  }

  return filters;
}

function createAssumptions(intent: PriceUpdateIntent): string[] {
  const assumptions = [
    "Only boardPrice and displayPrice are changed for room price updates.",
    "Existing capacity, constraints, payable price, extra guest price, and children prices are preserved.",
  ];

  if (!intent.from && !intent.to) {
    assumptions.push(
      "No date range was provided, so all current PMS price-capacity rows returned for the hotel are included.",
    );
  }

  return assumptions;
}

async function recordToolCall<T>(
  toolCalls: StructuredToolCall[],
  name: string,
  input: unknown,
  fn: () => Promise<T>,
  summarize: (result: T) => string,
): Promise<T> {
  try {
    const result = await fn();
    toolCalls.push({
      name,
      input,
      resultSummary: summarize(result),
      result,
      status: "SUCCESS",
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tool call failed.";
    toolCalls.push({
      name,
      input,
      resultSummary: message,
      status: "ERROR",
      error: message,
    });
    throw error;
  }
}

function normalizeNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function capitalizeFilterOperator(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
