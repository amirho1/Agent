import type {
  EntityId,
  MatchedRateSheetRow,
  PreparedPriceCapacityPayload,
  PriceCapacityUpsertItem,
  PriceDiffRow,
  ValidationIssue,
} from "../../shared/agent-types";
import { expandDateRange } from "./dates";

const defaultConstraint = {
  cta: false,
  ctd: false,
  minLos: 1,
  maxLos: 10,
  stopSell: false,
};

/**
 * Build a safe PMS upsert payload from matched and validated rows.
 * @param hotelId - Selected hotel ID.
 * @param matchedRows - Matched rows.
 * @param validationIssues - Validation issues.
 * @returns Prepared payload.
 */
export function preparePriceCapacityUpsert(
  hotelId: EntityId,
  matchedRows: MatchedRateSheetRow[],
  validationIssues: ValidationIssue[],
): PreparedPriceCapacityPayload {
  const items = matchedRows.flatMap((row) =>
    shouldPrepareRow(row, validationIssues)
      ? createItemsForRow(row)
      : ([] as PriceCapacityUpsertItem[]),
  );

  return {
    hotelId,
    items,
  };
}

/**
 * Build a payload from approved diff rows after manual review.
 * @param hotelId - Selected hotel ID.
 * @param diffRows - Diff rows.
 * @returns Prepared payload.
 */
export function buildPayloadFromApprovedDiffRows(
  hotelId: EntityId,
  diffRows: PriceDiffRow[],
): PreparedPriceCapacityPayload {
  return {
    hotelId,
    items: diffRows
      .filter((row) => row.approved && row.status !== "error")
      .map((row) => ({
        date: row.date,
        roomTypeProviderId: row.roomTypeProviderId as EntityId,
        count: row.newCount,
        constraint: defaultConstraint,
        price: {
          ratePlanId: row.ratePlanId as EntityId,
          boardPrice: row.newBoardPrice,
          displayPrice: row.newDisplayPrice,
          payablePrice: row.newPayablePrice,
        },
      })),
  };
}

/**
 * Check if a matched row should be included in the draft payload.
 * @param row - Matched row.
 * @param validationIssues - Validation issues.
 * @returns True when row is safe for draft preparation.
 */
function shouldPrepareRow(
  row: MatchedRateSheetRow,
  validationIssues: ValidationIssue[],
): boolean {
  const hasBlockingIssue = validationIssues.some(
    (issue) => issue.rowId === row.id && issue.level === "error",
  );

  return (
    !hasBlockingIssue &&
    Boolean(row.roomMatch.matchedId) &&
    Boolean(row.ratePlanMatch.matchedId)
  );
}

/**
 * Create daily PMS upsert items for one matched row.
 * @param row - Matched row.
 * @returns Upsert items.
 */
function createItemsForRow(
  row: MatchedRateSheetRow,
): PriceCapacityUpsertItem[] {
  return expandDateRange(row.from, row.to).map((date) => ({
    date,
    roomTypeProviderId: row.roomMatch.matchedId as EntityId,
    count: row.count,
    constraint: defaultConstraint,
    price: {
      ratePlanId: row.ratePlanMatch.matchedId as EntityId,
      boardPrice: row.boardPrice,
      displayPrice: row.displayPrice,
      payablePrice: row.payablePrice,
      extraGuestPrice: row.extraGuestPrice,
      childrenPrices: [],
    },
  }));
}
