import type {
  EntityId,
  ExtractedRateSheet,
  MatchedRateSheetRow,
  MatchResult,
  RatePlan,
  RoomTypeProvider,
} from "../../shared/agent-types";

type NamedEntity = {
  id: EntityId;
  name: string;
};

/**
 * Match extracted room and rate plan names against PMS data.
 * @param extractedRateSheet - Extracted rate sheet.
 * @param roomTypes - PMS room type providers.
 * @param ratePlans - PMS rate plans.
 * @returns Matched rows.
 */
export function matchRoomsAndRatePlans(
  extractedRateSheet: ExtractedRateSheet,
  roomTypes: RoomTypeProvider[],
  ratePlans: RatePlan[],
): MatchedRateSheetRow[] {
  return extractedRateSheet.dateRanges.flatMap((range) =>
    range.rooms.map((room) => ({
      id: room.rowId,
      from: range.from,
      to: range.to,
      roomName: room.roomName,
      ratePlanName: room.ratePlanName,
      roomMatch: matchName(room.roomName, roomTypes),
      ratePlanMatch: matchName(room.ratePlanName ?? "", ratePlans),
      boardPrice: room.boardPrice,
      displayPrice: room.displayPrice,
      payablePrice: room.payablePrice,
      extraGuestPrice: room.extraGuestPrice,
      count: room.count,
    })),
  );
}

/**
 * Match one extracted name against named entities.
 * @param extractedName - Extracted name.
 * @param entities - PMS entities.
 * @returns Match result.
 */
export function matchName(
  extractedName: string,
  entities: NamedEntity[],
): MatchResult {
  if (!extractedName.trim()) {
    return {
      extractedName,
      confidence: 0,
      status: "not_found",
    };
  }

  const candidates = entities.map((entity) => ({
    entity,
    confidence: calculateNameSimilarity(extractedName, entity.name),
  }));

  const best = candidates.sort(
    (left, right) => right.confidence - left.confidence,
  )[0];
  if (!best) {
    return {
      extractedName,
      confidence: 0,
      status: "not_found",
    };
  }

  return {
    extractedName,
    matchedId: best.entity.id,
    matchedName: best.entity.name,
    confidence: best.confidence,
    status: getMatchStatus(best.confidence),
  };
}

/**
 * Calculate a simple normalized string similarity score.
 * @param left - First string.
 * @param right - Second string.
 * @returns Similarity from 0 to 1.
 */
export function calculateNameSimilarity(left: string, right: string): number {
  const normalizedLeft = normalizeName(left);
  const normalizedRight = normalizeName(right);

  if (!normalizedLeft || !normalizedRight) {
    return 0;
  }

  if (normalizedLeft === normalizedRight) {
    return 1;
  }

  if (
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft)
  ) {
    return 0.9;
  }

  const leftTokens = new Set(normalizedLeft.split(" ").filter(Boolean));
  const rightTokens = new Set(normalizedRight.split(" ").filter(Boolean));
  const intersection = Array.from(leftTokens).filter((token) =>
    rightTokens.has(token),
  ).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;

  return union === 0 ? 0 : intersection / union;
}

/**
 * Normalize room and rate plan names for matching.
 * @param value - Source name.
 * @returns Normalized name.
 */
export function normalizeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[ي]/g, "ی")
    .replace(/[ك]/g, "ک")
    .replace(/[أإآ]/g, "ا")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ");
}

/**
 * Convert a similarity score to a match status.
 * @param confidence - Similarity score.
 * @returns Match status.
 */
function getMatchStatus(confidence: number): MatchResult["status"] {
  if (confidence >= 0.85) {
    return "matched";
  }

  if (confidence >= 0.6) {
    return "low_confidence";
  }

  return "not_found";
}
