import type {
  AgentTaskState,
  EntityId,
  ExtractedRateSheet,
  Hotel,
  MatchedRateSheetRow,
  PreparedPriceCapacityPayload,
  PriceDiffRow,
  ValidationIssue,
} from "../../shared/agent-types";
import type { ServerConfig } from "../config";
import {
  getExistingPriceCapacity,
  listRatePlans,
  listRoomTypes,
} from "../dummy-pms/client";
import { createPriceDiffRows } from "./diff";
import { matchRoomsAndRatePlans } from "./matching";
import { preparePriceCapacityUpsert } from "./prepare";
import { validatePriceUpdate } from "./validation";

export type PreparedPriceUpdate = {
  matchedRows: MatchedRateSheetRow[];
  validationIssues: ValidationIssue[];
  diffRows: PriceDiffRow[];
  preparedPayload: PreparedPriceCapacityPayload;
  taskState: AgentTaskState;
};

/**
 * Prepare a price-capacity update draft for human review.
 * @param config - Server config.
 * @param selectedHotel - Selected hotel.
 * @param extractedRateSheet - Extracted rate sheet.
 * @param currentState - Current task state.
 * @returns Prepared update data.
 */
export async function preparePriceUpdateWorkflow(
  config: ServerConfig,
  selectedHotel: Hotel,
  extractedRateSheet: ExtractedRateSheet,
  currentState: AgentTaskState = {},
): Promise<PreparedPriceUpdate> {
  const hotelId = selectedHotel.id;
  const [roomTypes, ratePlans] = await Promise.all([
    listRoomTypes(config, hotelId),
    listRatePlans(config, hotelId),
  ]);
  const matchedRows = matchRoomsAndRatePlans(
    extractedRateSheet,
    roomTypes,
    ratePlans,
  );
  const validationIssues = validatePriceUpdate(hotelId, matchedRows);
  const { from, to } = getOverallDateRange(extractedRateSheet);
  const existingRecords = await getExistingPriceCapacity(
    config,
    hotelId,
    from,
    to,
  );
  const diffRows = createPriceDiffRows(
    matchedRows,
    existingRecords,
    validationIssues,
  );
  const preparedPayload = preparePriceCapacityUpsert(
    hotelId,
    matchedRows,
    validationIssues,
  );
  const taskState = {
    ...currentState,
    selectedHotel,
    extractedRateSheet,
    matchedRows,
    validationIssues,
    diffRows,
    preparedPayload,
    approvalStatus: "pending" as const,
  };

  return {
    matchedRows,
    validationIssues,
    diffRows,
    preparedPayload,
    taskState,
  };
}

/**
 * Get the inclusive overall date range for an extracted sheet.
 * @param extractedRateSheet - Extracted rate sheet.
 * @returns Overall date range.
 */
function getOverallDateRange(extractedRateSheet: ExtractedRateSheet): {
  from: string;
  to: string;
} {
  const ranges = extractedRateSheet.dateRanges;
  if (ranges.length === 0) {
    throw new Error("No date ranges were extracted from the uploaded file.");
  }

  return {
    from: ranges.reduce(
      (earliest, range) => (range.from < earliest ? range.from : earliest),
      ranges[0].from,
    ),
    to: ranges.reduce(
      (latest, range) => (range.to > latest ? range.to : latest),
      ranges[0].to,
    ),
  };
}

/**
 * Find a selected hotel by ID from a list of hotels.
 * @param hotels - Available hotels.
 * @param hotelId - Hotel ID.
 * @returns Matching hotel.
 */
export function findSelectedHotel(hotels: Hotel[], hotelId: EntityId): Hotel {
  const hotel = hotels.find((item) => String(item.id) === String(hotelId));
  if (!hotel) {
    throw new Error(`Hotel ${hotelId} was not found.`);
  }

  return hotel;
}
