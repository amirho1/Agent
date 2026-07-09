import type {
  ExtractedDateRange,
  ExtractedRateSheet,
  ExtractedRateSheetRoom,
  ValidationIssue,
} from "../../shared/agent-types";
import { isIsoDate } from "../price-updates/dates";

type ParsedRow = Record<string, string>;

const requiredColumns = ["from", "to", "roomName"];

const columnAliases: Record<string, string> = {
  from: "from",
  startdate: "from",
  start: "from",
  از: "from",
  to: "to",
  enddate: "to",
  end: "to",
  تا: "to",
  roomname: "roomName",
  room: "roomName",
  roomtype: "roomName",
  اتاق: "roomName",
  rateplanname: "ratePlanName",
  rateplan: "ratePlanName",
  plan: "ratePlanName",
  پلن: "ratePlanName",
  boardprice: "boardPrice",
  board: "boardPrice",
  displayprice: "displayPrice",
  display: "displayPrice",
  payableprice: "payablePrice",
  payable: "payablePrice",
  extraguestprice: "extraGuestPrice",
  extraguest: "extraGuestPrice",
  count: "count",
  capacity: "count",
  ظرفیت: "count",
};

/**
 * Parse text or Markdown rate sheets into the normalized MVP shape.
 * @param text - Uploaded text content.
 * @returns Extracted rate sheet and parser issues.
 */
export function parseRateSheetText(text: string): {
  extractedRateSheet: ExtractedRateSheet;
  issues: ValidationIssue[];
} {
  const rows = parseDelimitedRows(text);
  const issues = validateParsedRows(rows);
  const dateRanges = buildDateRanges(rows);

  return {
    extractedRateSheet: {
      dateRanges,
    },
    issues,
  };
}

/**
 * Parse Markdown table, tab-delimited text, or comma-delimited text rows.
 * @param text - Uploaded text.
 * @returns Parsed rows.
 */
function parseDelimitedRows(text: string): ParsedRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  const tableLines = lines.filter((line) => line.includes("|"));
  if (tableLines.length >= 2) {
    return parseRows(tableLines, "|");
  }

  const tabLines = lines.filter((line) => line.includes("\t"));
  if (tabLines.length >= 2) {
    return parseRows(tabLines, "\t");
  }

  return parseRows(lines, ",");
}

/**
 * Parse lines with the selected delimiter.
 * @param lines - Source lines.
 * @param delimiter - Delimiter.
 * @returns Parsed rows.
 */
function parseRows(lines: string[], delimiter: string): ParsedRow[] {
  const headerLine = lines[0];
  if (!headerLine) {
    return [];
  }

  const headers = splitRow(headerLine, delimiter).map(normalizeColumnName);
  const dataLines = lines.slice(1).filter((line) => !isMarkdownSeparator(line));

  return dataLines.map((line) => {
    const values = splitRow(line, delimiter);
    return headers.reduce<ParsedRow>((row, header, index) => {
      row[header] = values[index]?.trim() ?? "";
      return row;
    }, {});
  });
}

/**
 * Split a delimited row and handle Markdown table edge pipes.
 * @param line - Source line.
 * @param delimiter - Delimiter.
 * @returns Cell values.
 */
function splitRow(line: string, delimiter: string): string[] {
  const normalizedLine =
    delimiter === "|" ? line.replace(/^\|/, "").replace(/\|$/, "") : line;

  return normalizedLine.split(delimiter).map((cell) => cell.trim());
}

/**
 * Normalize a source column name to the MVP canonical column.
 * @param value - Source column name.
 * @returns Canonical column name.
 */
function normalizeColumnName(value: string): string {
  const key = normalizeText(value);
  return columnAliases[key] ?? key;
}

/**
 * Check if a Markdown table separator row should be ignored.
 * @param line - Source line.
 * @returns True when line is a separator.
 */
function isMarkdownSeparator(line: string): boolean {
  return /^[\s|:-]+$/.test(line);
}

/**
 * Build normalized date ranges from parsed rows.
 * @param rows - Parsed source rows.
 * @returns Extracted date ranges.
 */
function buildDateRanges(rows: ParsedRow[]): ExtractedDateRange[] {
  const ranges = new Map<string, ExtractedRateSheetRoom[]>();

  rows.forEach((row, index) => {
    const from = row.from?.trim() ?? "";
    const to = row.to?.trim() || from;
    const key = `${from}:${to}`;
    const rooms = ranges.get(key) ?? [];
    rooms.push({
      rowId: `row-${index + 1}`,
      roomName: row.roomName?.trim() ?? "",
      ratePlanName: row.ratePlanName?.trim() || undefined,
      boardPrice: parseOptionalNumber(row.boardPrice),
      displayPrice: parseOptionalNumber(row.displayPrice),
      payablePrice: parseOptionalNumber(row.payablePrice),
      extraGuestPrice: parseOptionalNumber(row.extraGuestPrice),
      count: parseOptionalNumber(row.count),
    });
    ranges.set(key, rooms);
  });

  return Array.from(ranges.entries()).map(([key, rooms]) => {
    const [from, to] = key.split(":");
    return {
      from,
      to,
      rooms,
    };
  });
}

/**
 * Validate parsed row structure and values.
 * @param rows - Parsed rows.
 * @returns Validation issues.
 */
function validateParsedRows(rows: ParsedRow[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (rows.length === 0) {
    return [
      {
        level: "error",
        message:
          "The uploaded file did not contain a supported table. Use text or Markdown with from, to, roomName, and price columns.",
      },
    ];
  }

  for (const column of requiredColumns) {
    if (!(column in rows[0])) {
      issues.push({
        level: "error",
        field: column,
        message: `Missing required column: ${column}`,
      });
    }
  }

  rows.forEach((row, index) => {
    const rowId = `row-${index + 1}`;
    if (!isIsoDate(row.from)) {
      issues.push({
        level: "error",
        rowId,
        field: "from",
        message: "from must use YYYY-MM-DD format.",
      });
    }

    if (row.to && !isIsoDate(row.to)) {
      issues.push({
        level: "error",
        rowId,
        field: "to",
        message: "to must use YYYY-MM-DD format.",
      });
    }

    if (!row.roomName?.trim()) {
      issues.push({
        level: "error",
        rowId,
        field: "roomName",
        message: "roomName is required.",
      });
    }
  });

  return issues;
}

/**
 * Parse an optional number from a table cell.
 * @param value - Cell value.
 * @returns Parsed number or undefined.
 */
function parseOptionalNumber(value: string | undefined): number | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  const normalizedValue = value.replace(/[,،\s]/g, "");
  const numberValue = Number(normalizedValue);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

/**
 * Normalize text for column alias matching.
 * @param value - Input value.
 * @returns Normalized value.
 */
function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[ي]/g, "ی")
    .replace(/[ك]/g, "ک")
    .replace(/[\s_\-.]/g, "");
}
