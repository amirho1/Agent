import type {
  MatchedRateSheetRow,
  PriceCapacityRecord,
  PriceDiffRow,
  ValidationIssue,
} from "../../shared/agent-types";
import { expandDateRange } from "./dates";

/**
 * Create human review rows by comparing extracted values with PMS values.
 * @param matchedRows - Matched extracted rows.
 * @param existingRecords - Existing PMS records.
 * @param validationIssues - Validation issues.
 * @returns Diff rows.
 */
export function createPriceDiffRows(
  matchedRows: MatchedRateSheetRow[],
  existingRecords: PriceCapacityRecord[],
  validationIssues: ValidationIssue[],
): PriceDiffRow[] {
  const existingByKey = new Map(
    existingRecords.map((record) => [buildExistingKey(record), record]),
  );

  return matchedRows.flatMap((row) =>
    expandDateRange(row.from, row.to).map((date) => {
      const existing = existingByKey.get(
        [date, row.roomMatch.matchedId, row.ratePlanMatch.matchedId].join(":"),
      );
      const issues = validationIssues.filter((issue) => issue.rowId === row.id);
      const status = getDiffStatus(row, existing, issues);

      return {
        id: `${row.id}-${date}`,
        date,
        roomTypeProviderId: row.roomMatch.matchedId,
        roomName: row.roomMatch.matchedName ?? row.roomName,
        ratePlanId: row.ratePlanMatch.matchedId,
        ratePlanName: row.ratePlanMatch.matchedName ?? row.ratePlanName ?? "",
        oldBoardPrice: existing?.price?.boardPrice,
        newBoardPrice: row.boardPrice,
        oldDisplayPrice: existing?.price?.displayPrice,
        newDisplayPrice: row.displayPrice,
        oldPayablePrice: existing?.price?.payablePrice,
        newPayablePrice: row.payablePrice,
        oldCount: existing?.count,
        newCount: row.count,
        status,
        issues,
        approved: status !== "error",
      };
    }),
  );
}

/**
 * Build the unique key for an existing PMS record.
 * @param record - Existing PMS record.
 * @returns Composite key.
 */
function buildExistingKey(record: PriceCapacityRecord): string {
  return [
    record.date,
    record.roomTypeProviderId,
    record.price?.ratePlanId,
  ].join(":");
}

/**
 * Get review status for a diff row.
 * @param row - Matched extracted row.
 * @param existing - Existing PMS record.
 * @param issues - Validation issues for the row.
 * @returns Diff status.
 */
function getDiffStatus(
  row: MatchedRateSheetRow,
  existing: PriceCapacityRecord | undefined,
  issues: ValidationIssue[],
): PriceDiffRow["status"] {
  if (issues.some((issue) => issue.level === "error")) {
    return "error";
  }

  if (!existing) {
    return "new";
  }

  const changed =
    valueChanged(existing.price?.boardPrice, row.boardPrice) ||
    valueChanged(existing.price?.displayPrice, row.displayPrice) ||
    valueChanged(existing.price?.payablePrice, row.payablePrice) ||
    valueChanged(existing.count, row.count);

  return changed ? "changed" : "unchanged";
}

/**
 * Check if a value changed while ignoring undefined new values.
 * @param oldValue - Existing value.
 * @param newValue - New value.
 * @returns True when changed.
 */
function valueChanged(
  oldValue: number | undefined,
  newValue: number | undefined,
): boolean {
  return newValue !== undefined && oldValue !== newValue;
}
