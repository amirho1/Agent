import type {
  EntityId,
  MatchedRateSheetRow,
  ValidationIssue,
} from "../../shared/agent-types";
import { expandDateRange, isIsoDate } from "./dates";

/**
 * Validate matched rows before preparing a PMS write payload.
 * @param hotelId - Selected hotel ID.
 * @param matchedRows - Matched rate-sheet rows.
 * @returns Validation issues.
 */
export function validatePriceUpdate(
  hotelId: EntityId | undefined,
  matchedRows: MatchedRateSheetRow[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const keys = new Set<string>();

  if (!hotelId) {
    issues.push({
      level: "error",
      message: "A hotel must be selected before preparing an update.",
      field: "hotelId",
    });
  }

  for (const row of matchedRows) {
    issues.push(...validateMatchedRow(row));

    if (!isIsoDate(row.from) || !isIsoDate(row.to)) {
      continue;
    }

    for (const date of expandDateRange(row.from, row.to)) {
      const key = [
        date,
        row.roomMatch.matchedId,
        row.ratePlanMatch.matchedId,
      ].join(":");

      if (keys.has(key)) {
        issues.push({
          level: "error",
          rowId: row.id,
          message:
            "Duplicate room/date/rate plan record found in the extracted sheet.",
        });
      }

      keys.add(key);
    }
  }

  return issues;
}

/**
 * Validate a single matched row.
 * @param row - Matched row.
 * @returns Validation issues.
 */
function validateMatchedRow(row: MatchedRateSheetRow): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!isIsoDate(row.from)) {
    issues.push({
      level: "error",
      rowId: row.id,
      field: "from",
      message: "from must use YYYY-MM-DD format.",
    });
  }

  if (!isIsoDate(row.to)) {
    issues.push({
      level: "error",
      rowId: row.id,
      field: "to",
      message: "to must use YYYY-MM-DD format.",
    });
  }

  if (row.roomMatch.status !== "matched") {
    issues.push({
      level: row.roomMatch.status === "low_confidence" ? "warning" : "error",
      rowId: row.id,
      field: "roomName",
      message: `Room match is ${row.roomMatch.status}.`,
    });
  }

  if (row.ratePlanMatch.status !== "matched") {
    issues.push({
      level:
        row.ratePlanMatch.status === "low_confidence" ? "warning" : "error",
      rowId: row.id,
      field: "ratePlanName",
      message: `Rate plan match is ${row.ratePlanMatch.status}.`,
    });
  }

  if (!hasAnyPriceOrCount(row)) {
    issues.push({
      level: "error",
      rowId: row.id,
      message:
        "At least one price field or count must be present for an update row.",
    });
  }

  for (const field of [
    "boardPrice",
    "displayPrice",
    "payablePrice",
    "extraGuestPrice",
    "count",
  ] as const) {
    const value = row[field];
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      issues.push({
        level: "error",
        rowId: row.id,
        field,
        message: `${field} must be a valid non-negative number.`,
      });
    }
  }

  return issues;
}

/**
 * Check whether a matched row contains any update values.
 * @param row - Matched row.
 * @returns True when an update value exists.
 */
function hasAnyPriceOrCount(row: MatchedRateSheetRow): boolean {
  return [
    row.boardPrice,
    row.displayPrice,
    row.payablePrice,
    row.extraGuestPrice,
    row.count,
  ].some((value) => value !== undefined);
}
