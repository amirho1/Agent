import type {
  AgentActionProposal,
  EntityId,
  PriceCapacityRecord,
  RoomTypeProvider,
  StoredProposalOldValue,
} from "@/src/shared/agent-types";
import type { ServerConfig } from "../config";
import {
  getHotelRooms,
  getHotels,
  getPriceCapacityRows,
  getRatePlans,
  getRoomById,
} from "../dummy-pms/client";
import { agentActionProposalSchema } from "../price-actions/schemas";
import type {
  PreparedActionProposal,
  StructuredAgentStep,
  StructuredToolCall,
} from "../price-actions/proposal";
import type {
  PriceOperationUpdateIntent,
  RoomCreateIntent,
  RoomDeactivateIntent,
  RoomDeleteIntent,
  RoomQueryIntent,
  RoomUpdateIntent,
} from "./intent";
import { applyRoomQuery, type RoomPriceSummary } from "./read-result";

export async function prepareRoomCreateProposal(
  config: ServerConfig,
  intent: RoomCreateIntent,
): Promise<PreparedActionProposal> {
  const steps = createBaseSteps("create room");
  const toolCalls: StructuredToolCall[] = [];
  const existingRooms = await recordToolCall(
    toolCalls,
    "getHotelRooms",
    { hotelId: intent.hotelId },
    () => getHotelRooms(config, intent.hotelId),
    (result) => `Fetched ${result.length} rooms from PMS`,
  );
  const defaultCount = intent.defaultCount ?? 1;
  const assumptions =
    intent.defaultCount === undefined
      ? ["No default count was provided, so defaultCount is set to 1."]
      : [];

  steps.push({ label: `Fetched ${existingRooms.length} existing rooms` });
  steps.push({ label: "Waiting for user confirmation" });

  const proposal = agentActionProposalSchema.parse({
    type: "ROOM_CREATE",
    status: "PENDING_CONFIRMATION",
    title: `Create room ${intent.name}`,
    summary: `Create ${intent.name} in hotel ${intent.hotelId}.`,
    hotelId: intent.hotelId,
    affectedRowsCount: 1,
    assumptions,
    warnings: [],
    toolCalls: toToolSummaries(toolCalls),
    diffs: [
      createRoomDiff("CREATE", "new", "name", null, intent.name),
      createRoomDiff("CREATE", "new", "defaultCount", null, defaultCount),
      createRoomDiff("CREATE", "new", "isActive", null, true),
    ],
    pmsPayload: {
      action: "CREATE_ROOM",
      hotelId: intent.hotelId,
      room: {
        name: intent.name,
        defaultCount,
        isActive: true,
      },
    },
  });

  return {
    proposal,
    oldValues: [],
    steps,
    toolCalls,
  };
}

export async function prepareRoomUpdateProposal(
  config: ServerConfig,
  intent: RoomUpdateIntent,
): Promise<PreparedActionProposal> {
  const steps = createBaseSteps("update room");
  const toolCalls: StructuredToolCall[] = [];
  const { hotelId, room } = await resolveRoomTarget(
    config,
    toolCalls,
    intent.roomId,
    intent.hotelId,
  );
  const diffs = Object.entries(intent.update).map(([field, newValue]) =>
    createRoomDiff(
      "UPDATE",
      String(room.id),
      field,
      normalizeDiffValue(room[field]),
      normalizeDiffValue(newValue),
    ),
  );

  steps.push({ label: `Fetched room ${room.id} from PMS` });
  steps.push({ label: `Calculated ${diffs.length} proposed field updates` });
  steps.push({ label: "Waiting for user confirmation" });

  const proposal = agentActionProposalSchema.parse({
    type: "ROOM_UPDATE",
    status: "PENDING_CONFIRMATION",
    title: `Update room ${room.id}`,
    summary: `Update ${room.name} in hotel ${hotelId}.`,
    hotelId,
    affectedRowsCount: 1,
    assumptions: [],
    warnings: [],
    toolCalls: toToolSummaries(toolCalls),
    diffs,
    pmsPayload: {
      action: "UPDATE_ROOM",
      hotelId,
      roomId: room.id,
      update: intent.update,
    },
  });

  return {
    proposal,
    oldValues: [createStoredRoomValue(hotelId, room, intent.update)],
    steps,
    toolCalls,
  };
}

export async function prepareRoomDeleteProposal(
  config: ServerConfig,
  intent: RoomDeleteIntent,
): Promise<PreparedActionProposal> {
  const steps = createBaseSteps("delete room");
  const toolCalls: StructuredToolCall[] = [];
  const { hotelId, room } = await resolveRoomTarget(
    config,
    toolCalls,
    intent.roomId,
    intent.hotelId,
  );
  const linkedPriceRows = await recordToolCall(
    toolCalls,
    "getPriceCapacityRows",
    { hotelId, roomTypeProviderId: room.id },
    () =>
      getPriceCapacityRows(config, {
        hotelId,
        roomTypeProviderId: room.id,
      }),
    (result) => `Fetched ${result.length} linked price-capacity rows from PMS`,
  );
  const warnings =
    linkedPriceRows.length > 0
      ? [
          `Hard delete will also remove ${linkedPriceRows.length} linked price-capacity rows.`,
        ]
      : [];

  steps.push({ label: `Fetched room ${room.id} from PMS` });
  steps.push({ label: "Waiting for user confirmation" });

  const proposal = agentActionProposalSchema.parse({
    type: "ROOM_DELETE",
    status: "PENDING_CONFIRMATION",
    title: `Delete room ${room.id}`,
    summary: `Hard-delete ${room.name} from hotel ${hotelId}.`,
    hotelId,
    affectedRowsCount: 1,
    assumptions: [],
    warnings,
    toolCalls: toToolSummaries(toolCalls),
    diffs: [
      createRoomDiff("DELETE", String(room.id), "name", room.name, null),
      createRoomDiff(
        "DELETE",
        String(room.id),
        "isActive",
        normalizeDiffValue(room.isActive),
        null,
      ),
    ],
    pmsPayload: {
      action: "DELETE_ROOM",
      hotelId,
      roomId: room.id,
    },
  });

  return {
    proposal,
    oldValues: [createStoredRoomValue(hotelId, room, { name: room.name })],
    steps,
    toolCalls,
  };
}

export async function prepareRoomDeactivateProposal(
  config: ServerConfig,
  intent: RoomDeactivateIntent,
): Promise<PreparedActionProposal> {
  if ("noAvailability" in intent) {
    return prepareNoAvailabilityDeactivateProposal(config, intent);
  }

  const steps = createBaseSteps("deactivate room");
  const toolCalls: StructuredToolCall[] = [];
  const { hotelId, room } = await resolveRoomTarget(
    config,
    toolCalls,
    intent.roomId,
    intent.hotelId,
  );

  steps.push({ label: `Fetched room ${room.id} from PMS` });
  steps.push({ label: "Waiting for user confirmation" });

  const proposal = agentActionProposalSchema.parse({
    type: "ROOM_DEACTIVATE",
    status: "PENDING_CONFIRMATION",
    title: `Deactivate room ${room.id}`,
    summary: `Set ${room.name} to inactive in hotel ${hotelId}.`,
    hotelId,
    affectedRowsCount: 1,
    assumptions: [],
    warnings: [],
    toolCalls: toToolSummaries(toolCalls),
    diffs: [
      createRoomDiff(
        "DEACTIVATE",
        String(room.id),
        "isActive",
        normalizeDiffValue(room.isActive),
        false,
      ),
    ],
    pmsPayload: {
      action: "DEACTIVATE_ROOM",
      hotelId,
      roomId: room.id,
      update: { isActive: false },
    },
  });

  return {
    proposal,
    oldValues: [
      createStoredRoomValue(hotelId, room, { isActive: room.isActive }),
    ],
    steps,
    toolCalls,
  };
}

export async function preparePriceOperationProposal(
  config: ServerConfig,
  intent: PriceOperationUpdateIntent,
): Promise<PreparedActionProposal> {
  const steps = createBaseSteps("update room prices");
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
  const matchingSummaries = applyRoomQuery(
    rooms.map((room) => summarizeRoom(room, priceRows)),
    createPriceMutationRoomFilter(intent.selection),
  );
  if (matchingSummaries.length === 0) {
    throw new Error(
      "No matching PMS rooms were found for this request. No update was prepared.",
    );
  }

  const selectedSummaries = selectPriceMutationRooms(matchingSummaries, intent);
  const selectedRoomIds = new Set(
    selectedSummaries.map((summary) => String(summary.room.id)),
  );
  const roomNameById = new Map(
    rooms.map((room) => [String(room.id), room.name]),
  );
  const validRows = priceRows.filter(
    (row) =>
      selectedRoomIds.has(String(row.roomTypeProviderId)) &&
      intent.fields.some((field) => typeof row.price?.[field] === "number") &&
      row.price?.ratePlanId !== undefined,
  );
  const diffs: AgentActionProposal["diffs"] = [];
  const oldValues: StoredProposalOldValue[] = [];
  const payloadItems = validRows.flatMap((row) => {
    const rowId = buildPriceRowId(row);
    const nextPrice = { ...row.price };
    let changed = false;

    for (const field of intent.fields) {
      const oldValue = row.price?.[field];
      if (typeof oldValue !== "number") {
        continue;
      }

      const newValue = calculatePriceOperation(oldValue, intent);
      if (newValue === oldValue) {
        continue;
      }

      changed = true;
      nextPrice[field] = newValue;
      diffs.push({
        action: "UPDATE",
        entityType: "PRICE_CAPACITY",
        rowId,
        roomTypeProviderId: Number(row.roomTypeProviderId),
        roomName: roomNameById.get(String(row.roomTypeProviderId)),
        date: row.date,
        ratePlanId: Number(row.price?.ratePlanId),
        field,
        oldValue,
        newValue,
      });
    }

    if (!changed) {
      return [];
    }

    oldValues.push({
      entityType: "PRICE_CAPACITY",
      rowId,
      date: row.date,
      roomTypeProviderId: Number(row.roomTypeProviderId),
      ratePlanId: Number(row.price?.ratePlanId),
      boardPrice: normalizeNullableNumber(row.price?.boardPrice),
      displayPrice: normalizeNullableNumber(row.price?.displayPrice),
      payablePrice: normalizeNullableNumber(row.price?.payablePrice),
    });

    return [
      {
        date: row.date,
        roomTypeProviderId: row.roomTypeProviderId,
        count: row.count,
        constraint: row.constraint,
        price: {
          ...nextPrice,
          ratePlanId: row.price?.ratePlanId,
        },
      },
    ];
  });
  const operationLabel = createOperationLabel(intent);
  const warnings: string[] = [];
  if (payloadItems.length === 0) {
    warnings.push("No matching PMS price-capacity rows were found.");
  }

  if (
    intent.selection.limit !== undefined &&
    selectedSummaries.length < intent.selection.limit
  ) {
    warnings.push(
      createRequestedRoomsWarning(
        intent.selection.limit,
        selectedSummaries.length,
      ),
    );
  }

  const assumptions = [
    `Selected ${selectedSummaries.length} matching ${pluralize("room", selectedSummaries.length)} and generated ${payloadItems.length} executable price-capacity ${pluralize("row", payloadItems.length)}.`,
    "No date range was provided, so all current PMS price-capacity rows returned for the selected rooms are included.",
  ];

  if (
    intent.fields.includes("boardPrice") &&
    intent.fields.includes("displayPrice")
  ) {
    assumptions.push(
      "Multiple price fields were requested; only fields with current numeric values are changed.",
    );
  }

  if (intent.fields.length > 1 && intent.selection.sort) {
    assumptions.push(
      "Room ranking used displayPrice because multiple price fields were requested.",
    );
  }

  steps.push({ label: `Matched ${matchingSummaries.length} rooms` });
  steps.push({ label: `Selected ${selectedSummaries.length} rooms` });
  steps.push({ label: `Selected ${validRows.length} price-capacity rows` });
  steps.push({ label: `Calculated ${diffs.length} proposed price updates` });
  steps.push({ label: "Waiting for user confirmation" });

  const proposal = agentActionProposalSchema.parse({
    type: "PRICE_CAPACITY_UPDATE",
    status: "PENDING_CONFIRMATION",
    title: `${operationLabel} ${intent.fields.join(", ")}`,
    summary: `${operationLabel} for ${payloadItems.length} price-capacity rows across ${selectedSummaries.length} selected rooms in hotel ${intent.hotelId}.`,
    hotelId: intent.hotelId,
    affectedRowsCount: payloadItems.length,
    assumptions,
    warnings,
    toolCalls: toToolSummaries(toolCalls),
    diffs,
    pmsPayload: {
      items: payloadItems,
    },
  });

  return {
    proposal,
    oldValues,
    steps,
    toolCalls,
  };
}

export const prepareFixedPriceUpdateProposal = preparePriceOperationProposal;

async function prepareNoAvailabilityDeactivateProposal(
  config: ServerConfig,
  intent: Extract<RoomDeactivateIntent, { noAvailability: true }>,
): Promise<PreparedActionProposal> {
  const steps = createBaseSteps("deactivate rooms with no availability");
  const toolCalls: StructuredToolCall[] = [];
  const [rooms, priceRows] = await Promise.all([
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
  ]);
  const targets = rooms.filter(
    (room) =>
      room.isActive !== false &&
      !priceRows.some(
        (row) =>
          String(row.roomTypeProviderId) === String(room.id) &&
          Number(row.count ?? 0) > 0,
      ),
  );
  const diffs = targets.map((room) =>
    createRoomDiff("DEACTIVATE", String(room.id), "isActive", true, false),
  );

  steps.push({
    label: `Selected ${targets.length} rooms with no availability`,
  });
  steps.push({ label: "Waiting for user confirmation" });

  const proposal = agentActionProposalSchema.parse({
    type: "ROOM_DEACTIVATE",
    status: "PENDING_CONFIRMATION",
    title: "Deactivate rooms with no availability",
    summary: `Deactivate ${targets.length} rooms in hotel ${intent.hotelId}.`,
    hotelId: intent.hotelId,
    affectedRowsCount: targets.length,
    assumptions: [
      "No availability means the room has no current price-capacity row with count greater than 0.",
    ],
    warnings:
      targets.length === 0 ? ["No matching active rooms were found."] : [],
    toolCalls: toToolSummaries(toolCalls),
    diffs,
    pmsPayload: {
      items: targets.map((room) => ({
        action: "DEACTIVATE_ROOM",
        hotelId: intent.hotelId,
        roomId: room.id,
        update: { isActive: false },
      })),
    },
  });

  return {
    proposal,
    oldValues: targets.map((room) =>
      createStoredRoomValue(intent.hotelId, room, { isActive: room.isActive }),
    ),
    steps,
    toolCalls,
  };
}

async function resolveRoomTarget(
  config: ServerConfig,
  toolCalls: StructuredToolCall[],
  roomId: EntityId,
  hotelId?: EntityId,
): Promise<{ hotelId: EntityId; room: RoomTypeProvider }> {
  if (hotelId) {
    const room = await recordToolCall(
      toolCalls,
      "getRoomById",
      { hotelId, roomId },
      () => getRoomById(config, hotelId, roomId),
      (result) => `Fetched room ${result.id} from PMS`,
    );
    return { hotelId, room };
  }

  const hotels = await recordToolCall(
    toolCalls,
    "getHotels",
    {},
    () => getHotels(config),
    (result) => `Fetched ${result.length} hotels from PMS`,
  );
  const matches: Array<{ hotelId: EntityId; room: RoomTypeProvider }> = [];

  for (const hotel of hotels) {
    const rooms = await recordToolCall(
      toolCalls,
      "getHotelRooms",
      { hotelId: hotel.id },
      () => getHotelRooms(config, hotel.id),
      (result) => `Fetched ${result.length} rooms for hotel ${hotel.id}`,
    );
    const room = rooms.find((item) => String(item.id) === String(roomId));
    if (room) {
      matches.push({ hotelId: hotel.id, room });
    }
  }

  if (matches.length === 0) {
    throw new Error(`Room ${roomId} was not found in PMS.`);
  }

  if (matches.length > 1) {
    throw new Error(
      `Room ${roomId} exists in multiple hotels. Please include the hotel ID.`,
    );
  }

  return matches[0];
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

  return {
    room,
    priceRows: roomRows,
    lowestDisplayPrice:
      displayPrices.length > 0 ? Math.min(...displayPrices) : null,
    highestDisplayPrice:
      displayPrices.length > 0 ? Math.max(...displayPrices) : null,
    selectedPriceRow: roomRows[0],
  };
}

function createPriceMutationRoomFilter(
  selection: RoomQueryIntent,
): RoomQueryIntent {
  return {
    ...selection,
    sort: undefined,
    limit: undefined,
  };
}

function selectPriceMutationRooms(
  summaries: RoomPriceSummary[],
  intent: PriceOperationUpdateIntent,
): RoomPriceSummary[] {
  let result = [...summaries];
  const rankingField = getPriceRankingField(intent);

  if (intent.selection.sort === "CHEAPEST") {
    result = result.sort((left, right) =>
      compareRoomSummaries(left, right, rankingField, "asc"),
    );
  }

  if (intent.selection.sort === "MOST_EXPENSIVE") {
    result = result.sort((left, right) =>
      compareRoomSummaries(left, right, rankingField, "desc"),
    );
  }

  if (intent.selection.limit) {
    result = result.slice(0, intent.selection.limit);
  }

  return result;
}

function getPriceRankingField(
  intent: PriceOperationUpdateIntent,
): PriceOperationUpdateIntent["fields"][number] {
  return intent.fields.length === 1 ? intent.fields[0] : "displayPrice";
}

function compareRoomSummaries(
  left: RoomPriceSummary,
  right: RoomPriceSummary,
  field: PriceOperationUpdateIntent["fields"][number],
  direction: "asc" | "desc",
): number {
  const leftValue = getRoomPriceValue(left, field, direction);
  const rightValue = getRoomPriceValue(right, field, direction);

  if (leftValue === null && rightValue === null) {
    return 0;
  }

  if (leftValue === null) {
    return 1;
  }

  if (rightValue === null) {
    return -1;
  }

  return direction === "asc" ? leftValue - rightValue : rightValue - leftValue;
}

function getRoomPriceValue(
  summary: RoomPriceSummary,
  field: PriceOperationUpdateIntent["fields"][number],
  direction: "asc" | "desc",
): number | null {
  const values = summary.priceRows
    .map((row) => getPriceValue(row, field))
    .filter((value): value is number => value !== null);

  if (values.length === 0) {
    return null;
  }

  return direction === "asc" ? Math.min(...values) : Math.max(...values);
}

function getPriceValue(
  row: PriceCapacityRecord,
  field: PriceOperationUpdateIntent["fields"][number],
): number | null {
  const value = row.price?.[field];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function createRequestedRoomsWarning(
  requested: number,
  available: number,
): string {
  return `You requested ${requested} rooms, but only ${available} matching ${pluralize("room", available)} ${available === 1 ? "exists" : "exist"}.`;
}

function pluralize(label: string, count: number): string {
  return count === 1 ? label : `${label}s`;
}

function createBaseSteps(action: string): StructuredAgentStep[] {
  return [
    { label: "Understood user request" },
    { label: `Detected action type: ${action}` },
  ];
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
    const message =
      error instanceof Error ? error.message : "Tool call failed.";
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

function toToolSummaries(toolCalls: StructuredToolCall[]) {
  return toolCalls.map((toolCall) => ({
    name: toolCall.name,
    input: toolCall.input,
    resultSummary: toolCall.resultSummary,
  }));
}

function createRoomDiff(
  action: NonNullable<AgentActionProposal["diffs"][number]["action"]>,
  rowId: string,
  field: string,
  oldValue: string | number | boolean | null,
  newValue: string | number | boolean | null,
): AgentActionProposal["diffs"][number] {
  return {
    action,
    entityType: "ROOM",
    rowId,
    field,
    oldValue,
    newValue,
  };
}

function createStoredRoomValue(
  hotelId: EntityId,
  room: RoomTypeProvider,
  fields: Record<string, unknown>,
): StoredProposalOldValue {
  const values = Object.fromEntries(
    Object.keys(fields).map((field) => [
      field,
      normalizeDiffValue(room[field]),
    ]),
  );

  return {
    entityType: "ROOM",
    rowId: String(room.id),
    hotelId,
    roomId: room.id,
    values,
  };
}

function buildPriceRowId(row: PriceCapacityRecord): string {
  return [row.date, row.roomTypeProviderId, row.price?.ratePlanId].join(":");
}

function normalizeNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeDiffValue(value: unknown): string | number | boolean | null {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  return null;
}

function normalizePrice(value: number): number {
  return Math.max(1, Number(value.toFixed(2)));
}

function calculatePriceOperation(
  oldValue: number,
  intent: PriceOperationUpdateIntent,
): number {
  const operation = intent.operation;
  let value: number;

  switch (operation.type) {
    case "PERCENT_CHANGE": {
      const multiplier =
        operation.direction === "increase"
          ? 1 + operation.value / 100
          : 1 - operation.value / 100;
      value = oldValue * multiplier;
      break;
    }
    case "DELTA":
      value =
        operation.direction === "increase"
          ? oldValue + operation.value
          : oldValue - operation.value;
      break;
    case "MULTIPLY":
      value = oldValue * operation.value;
      break;
    case "DIVIDE":
      value = oldValue / operation.value;
      break;
    case "SET":
      value = operation.value;
      break;
    case "CAP_AT":
      value = Math.min(oldValue, operation.value);
      break;
    case "FLOOR_AT":
      value = Math.max(oldValue, operation.value);
      break;
    default:
      value = oldValue;
  }

  const rounded =
    intent.roundTo && intent.roundTo > 0
      ? Math.round(value / intent.roundTo) * intent.roundTo
      : value;

  return normalizePrice(rounded);
}

function createOperationLabel(intent: PriceOperationUpdateIntent): string {
  const operation = intent.operation;

  switch (operation.type) {
    case "PERCENT_CHANGE":
      return `${capitalize(operation.direction)} prices by ${operation.value}%`;
    case "DELTA":
      return `${operation.direction === "increase" ? "Add" : "Subtract"} ${operation.value}`;
    case "MULTIPLY":
      return `Multiply prices by ${operation.value}`;
    case "DIVIDE":
      return `Divide prices by ${operation.value}`;
    case "SET":
      return `Set prices to ${operation.value}`;
    case "CAP_AT":
      return `Cap prices at ${operation.value}`;
    case "FLOOR_AT":
      return `Floor prices at ${operation.value}`;
    default:
      return "Update prices";
  }
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
