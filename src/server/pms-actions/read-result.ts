import type {
  AgentReadResult,
  PriceCapacityRecord,
  RatePlan,
  RoomTypeProvider,
} from "@/src/shared/agent-types";
import type { ServerConfig } from "../config";
import {
  getHotelRooms,
  getPriceCapacityRows,
  getRatePlans,
} from "../dummy-pms/client";
import { agentReadResultSchema } from "../price-actions/schemas";
import type { StructuredAgentStep, StructuredToolCall } from "../price-actions/proposal";
import type { RoomQueryIntent } from "./intent";

export type PreparedReadResult = {
  readResult: AgentReadResult;
  steps: StructuredAgentStep[];
  toolCalls: StructuredToolCall[];
};

export type RoomPriceSummary = {
  room: RoomTypeProvider;
  priceRows: PriceCapacityRecord[];
  lowestDisplayPrice: number | null;
  highestDisplayPrice: number | null;
  selectedPriceRow?: PriceCapacityRecord;
};

export async function prepareRoomReadResult(
  config: ServerConfig,
  intent: RoomQueryIntent,
): Promise<PreparedReadResult> {
  const steps: StructuredAgentStep[] = [
    { label: "Understood user request" },
    { label: `Detected action type: ${intent.type.toLowerCase()}` },
  ];
  const toolCalls: StructuredToolCall[] = [];

  const [rooms, priceRows, ratePlans] = await Promise.all([
    recordToolCall(
      toolCalls,
      "getHotelRooms",
      { hotelId: intent.hotelId },
      () => getHotelRooms(config, intent.hotelId),
      (result) => `Fetched ${result.length} rooms from PMS`,
    ),
    recordToolCall(
      toolCalls,
      "getPriceCapacityRows",
      { hotelId: intent.hotelId },
      () => getPriceCapacityRows(config, { hotelId: intent.hotelId }),
      (result) => `Fetched ${result.length} price-capacity rows from PMS`,
    ),
    recordToolCall(
      toolCalls,
      "getRatePlans",
      { hotelId: intent.hotelId },
      () => getRatePlans(config, intent.hotelId),
      (result) => `Fetched ${result.length} rate plans from PMS`,
    ),
  ]);

  steps.push({ label: `Fetched ${rooms.length} rooms from PMS` });
  steps.push({ label: `Fetched ${priceRows.length} price-capacity rows from PMS` });

  const ratePlanById = new Map(ratePlans.map((plan) => [String(plan.id), plan]));
  const summaries = applyRoomQuery(
    rooms.map((room) => summarizeRoom(room, priceRows)),
    intent,
  );
  const rows = summaries.map((summary) =>
    createRoomResultRow(summary, ratePlanById),
  );

  const readResult = agentReadResultSchema.parse({
    type: intent.type,
    title: createReadTitle(intent),
    summary: `Found ${rows.length} matching rooms for hotel ${intent.hotelId}.`,
    hotelId: intent.hotelId,
    matchedRowsCount: rows.length,
    columns: [
      "roomId",
      "name",
      "defaultCount",
      "isActive",
      "lowestDisplayPrice",
      "ratePlan",
      "date",
    ],
    rows,
    toolCalls: toolCalls.map((toolCall) => ({
      name: toolCall.name,
      input: toolCall.input,
      resultSummary: toolCall.resultSummary,
    })),
  });

  steps.push({ label: `Prepared read-only table with ${rows.length} rows` });

  return {
    readResult,
    steps,
    toolCalls,
  };
}

export function applyRoomQuery(
  summaries: RoomPriceSummary[],
  intent: RoomQueryIntent,
): RoomPriceSummary[] {
  let result = summaries.filter((summary) => matchesRoomQuery(summary, intent));

  if (intent.sort === "CHEAPEST") {
    result = result.sort(
      (left, right) =>
        nullableSortValue(left.lowestDisplayPrice, Number.POSITIVE_INFINITY) -
        nullableSortValue(right.lowestDisplayPrice, Number.POSITIVE_INFINITY),
    );
  }

  if (intent.sort === "MOST_EXPENSIVE") {
    result = result.sort(
      (left, right) =>
        nullableSortValue(right.highestDisplayPrice, Number.NEGATIVE_INFINITY) -
        nullableSortValue(left.highestDisplayPrice, Number.NEGATIVE_INFINITY),
    );
  }

  if (intent.limit) {
    result = result.slice(0, intent.limit);
  }

  return result;
}

function summarizeRoom(
  room: RoomTypeProvider,
  priceRows: PriceCapacityRecord[],
): RoomPriceSummary {
  const roomRows = priceRows.filter(
    (row) => String(row.roomTypeProviderId) === String(room.id),
  );
  const displayPrices = roomRows
    .map((row) => row.price?.displayPrice)
    .filter((value): value is number => typeof value === "number");
  const lowestDisplayPrice =
    displayPrices.length > 0 ? Math.min(...displayPrices) : null;
  const highestDisplayPrice =
    displayPrices.length > 0 ? Math.max(...displayPrices) : null;
  const selectedPriceRow =
    lowestDisplayPrice === null
      ? roomRows[0]
      : roomRows.find((row) => row.price?.displayPrice === lowestDisplayPrice);

  return {
    room,
    priceRows: roomRows,
    lowestDisplayPrice,
    highestDisplayPrice,
    selectedPriceRow,
  };
}

function matchesRoomQuery(
  summary: RoomPriceSummary,
  intent: RoomQueryIntent,
): boolean {
  if (intent.roomId && Number(summary.room.id) !== intent.roomId) {
    return false;
  }

  if (
    intent.name &&
    !normalizeSearchText(summary.room.name).includes(normalizeSearchText(intent.name))
  ) {
    return false;
  }

  if (
    intent.isActive !== undefined &&
    Boolean(summary.room.isActive) !== intent.isActive
  ) {
    return false;
  }

  if (
    intent.noAvailability &&
    summary.priceRows.some((row) => Number(row.count ?? 0) > 0)
  ) {
    return false;
  }

  if (intent.priceFilter) {
    return summary.priceRows.some((row) => {
      const value = row.price?.[intent.priceFilter?.field ?? "displayPrice"];
      return (
        typeof value === "number" &&
        compareNumber(
          value,
          intent.priceFilter?.operator ?? "gt",
          intent.priceFilter?.value ?? 0,
        )
      );
    });
  }

  return true;
}

function createRoomResultRow(
  summary: RoomPriceSummary,
  ratePlanById: Map<string, RatePlan>,
): Record<string, unknown> {
  const selectedPriceRow = summary.selectedPriceRow;
  const ratePlan = selectedPriceRow?.price?.ratePlanId
    ? ratePlanById.get(String(selectedPriceRow.price.ratePlanId))
    : undefined;

  return {
    roomId: summary.room.id,
    name: summary.room.name,
    defaultCount: summary.room.defaultCount ?? null,
    isActive: summary.room.isActive ?? null,
    lowestDisplayPrice: summary.lowestDisplayPrice,
    ratePlan: ratePlan?.name ?? null,
    date: selectedPriceRow?.date ?? null,
  };
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

function createReadTitle(intent: RoomQueryIntent): string {
  if (intent.sort === "CHEAPEST") {
    return `Cheapest rooms for hotel ${intent.hotelId}`;
  }

  if (intent.sort === "MOST_EXPENSIVE") {
    return `Most expensive rooms for hotel ${intent.hotelId}`;
  }

  return `Rooms for hotel ${intent.hotelId}`;
}

function nullableSortValue(value: number | null, fallback: number): number {
  return value ?? fallback;
}

function compareNumber(left: number, operator: string, right: number): boolean {
  switch (operator) {
    case "gt":
      return left > right;
    case "gte":
      return left >= right;
    case "lt":
      return left < right;
    case "lte":
      return left <= right;
    default:
      return false;
  }
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}
