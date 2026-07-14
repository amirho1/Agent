import type {
  ExtractedRateSheet,
  ExtractedRateSheetRow,
  ValidationIssue,
} from "@/src/shared/agent-types";
import { isIsoDate } from "../price-updates/dates";

type ParsedTable = {
  headers: string[];
  rows: string[][];
};

type ParsedRow = Record<string, string>;
type MetadataKey = Exclude<keyof ExtractedRateSheet, "rows">;

const metadataAliases: Record<string, MetadataKey> = {
  hotel: "hotelName",
  hotelname: "hotelName",
  نامهتل: "hotelName",
  title: "title",
  ratesheettitle: "title",
  ratetitle: "title",
  عنواننرخنامه: "title",
  bundle: "title",
  bundlename: "title",
  from: "from",
  start: "from",
  startdate: "from",
  تاریخشروع: "from",
  از: "from",
  to: "to",
  end: "to",
  enddate: "to",
  تاریخپایان: "to",
  تا: "to",
  currency: "currency",
  واحدپول: "currency",
};

const rowAliases: Record<string, string> = {
  room: "roomName",
  roomname: "roomName",
  roomtype: "roomName",
  ناماتاق: "roomName",
  اتاق: "roomName",
  rateplan: "ratePlanName",
  rateplanname: "ratePlanName",
  plan: "ratePlanName",
  mealtype: "ratePlanName",
  نرخنامه: "ratePlanName",
  وعدهغذایی: "ignored",
  boardprice: "boardPrice",
  board: "boardPrice",
  قیمتبرد: "boardPrice",
  displayprice: "displayPrice",
  display: "displayPrice",
  قیمتنمایش: "displayPrice",
  payableprice: "payablePrice",
  payable: "payablePrice",
  قیمتقابلپرداخت: "payablePrice",
  price: "genericPrice",
  قیمت: "genericPrice",
  extraguestprice: "ignored",
  extraguest: "ignored",
  قیمتنفراضافه: "ignored",
  count: "ignored",
  capacity: "ignored",
  تعداداتاق: "ignored",
  ظرفیتآنلاین: "ignored",
  تعدادنفرات: "ignored",
  نفراضافهمجاز: "ignored",
};

export function parseRateSheetText(text: string): {
  extractedRateSheet: ExtractedRateSheet;
  issues: ValidationIssue[];
} {
  const issues: ValidationIssue[] = [];
  const tables = parseMarkdownTables(text);
  const extractedRateSheet: ExtractedRateSheet = {
    ...parseMetadata(text, tables),
    rows: [],
  };

  const tableRows = parseRowsFromTables(tables, issues);
  const fallbackRows =
    tableRows.length === 0 ? parseRowsFromPlainText(text) : [];
  extractedRateSheet.rows = tableRows.length > 0 ? tableRows : fallbackRows;

  extractedRateSheet.from = normalizeDate(extractedRateSheet.from);
  extractedRateSheet.to = normalizeDate(extractedRateSheet.to);
  if (extractedRateSheet.from && !extractedRateSheet.to) {
    extractedRateSheet.to = extractedRateSheet.from;
  }

  validateExtractedSheet(extractedRateSheet, issues);

  return {
    extractedRateSheet,
    issues,
  };
}

function parseMetadata(
  text: string,
  tables: ParsedTable[],
): Omit<ExtractedRateSheet, "rows"> {
  const metadata: Omit<ExtractedRateSheet, "rows"> = {};
  const normalizedText = toEnglishDigits(text);

  for (const table of tables) {
    if (table.rows.length !== 1) {
      continue;
    }

    table.headers.forEach((header, index) => {
      const target = metadataAliases[normalizeKey(header)];
      const value = table.rows[0]?.[index]?.trim();
      if (target && value) {
        metadata[target] = value;
      }
    });
  }

  const linePatterns: Array<[MetadataKey, RegExp]> = [
    ["hotelName", /(?:hotel|هتل)\s*[:=]\s*(.+)/i],
    ["title", /(?:rate\s*sheet|bundle|title|نرخنامه)\s*[:=]\s*(.+)/i],
    ["from", /(?:from|start|از)\s*[:=]\s*([0-9۰-۹٠-٩/-]+)/i],
    ["to", /(?:to|end|تا)\s*[:=]\s*([0-9۰-۹٠-٩/-]+)/i],
    ["currency", /(?:currency|واحد\s*پول)\s*[:=]\s*(.+)/i],
  ];

  for (const [key, pattern] of linePatterns) {
    if (metadata[key]) {
      continue;
    }

    const match = normalizedText.match(pattern);
    if (match?.[1]) {
      metadata[key] = match[1].split(/\r?\n/)[0].trim();
    }
  }

  return metadata;
}

function parseRowsFromTables(
  tables: ParsedTable[],
  issues: ValidationIssue[],
): ExtractedRateSheetRow[] {
  return tables.flatMap((table) => {
    const headers = table.headers.map(
      (header) => rowAliases[normalizeKey(header)],
    );
    if (!headers.includes("roomName") || !headers.includes("ratePlanName")) {
      return [];
    }

    return table.rows.map((values, index) =>
      createExtractedRow(`row-${index + 1}`, headers, values, issues),
    );
  });
}

function parseRowsFromPlainText(text: string): ExtractedRateSheetRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.flatMap((line, index) => {
    if (!/(?:room|اتاق|RO|BB|HB|FB|UAI)/i.test(line)) {
      return [];
    }

    const row: ExtractedRateSheetRow = {
      rowId: `row-${index + 1}`,
      roomName: extractValue(line, /(?:room|اتاق)\s*[:=]\s*([^,;]+)/i) ?? "",
      ratePlanName:
        extractValue(line, /(?:rate\s*plan|plan|نرخنامه)\s*[:=]\s*([^,;]+)/i) ??
        extractValue(line, /\b(RO|BB|HB|FB|UAI)\b/i) ??
        "",
      boardPrice: parseOptionalNumber(
        extractValue(
          line,
          /(?:boardPrice|board\s*price|قیمت\s*برد)\s*[:=]\s*([^,;]+)/i,
        ),
      ),
      displayPrice: parseOptionalNumber(
        extractValue(
          line,
          /(?:displayPrice|display\s*price|قیمت\s*نمایش)\s*[:=]\s*([^,;]+)/i,
        ),
      ),
      payablePrice: parseOptionalNumber(
        extractValue(
          line,
          /(?:payablePrice|payable\s*price|قیمت\s*قابل\s*پرداخت)\s*[:=]\s*([^,;]+)/i,
        ),
      ),
      genericPrice: parseOptionalNumber(
        extractValue(line, /(?:^|[,;])\s*(?:price|قیمت)\s*[:=]\s*([^,;]+)/i),
      ),
      ignoredFields: [],
    };

    return row.roomName || row.ratePlanName ? [row] : [];
  });
}

function createExtractedRow(
  rowId: string,
  headers: Array<string | undefined>,
  values: string[],
  issues: ValidationIssue[],
): ExtractedRateSheetRow {
  const row: ExtractedRateSheetRow = {
    rowId,
    roomName: "",
    ratePlanName: "",
    ignoredFields: [],
  };

  headers.forEach((header, index) => {
    const value = values[index]?.trim();
    if (!header || !value) {
      return;
    }

    if (header === "ignored") {
      row.ignoredFields.push(values[index] ?? "");
      return;
    }

    if (header === "roomName" || header === "ratePlanName") {
      row[header] = value;
      return;
    }

    const numberValue = parseOptionalNumber(value);
    if (numberValue === undefined) {
      issues.push({
        level: "error",
        rowId,
        field: header,
        message: `${header} must be a valid number.`,
      });
      return;
    }

    row[header as "boardPrice" | "displayPrice" | "payablePrice"] = numberValue;
  });

  return row;
}

function validateExtractedSheet(
  sheet: ExtractedRateSheet,
  issues: ValidationIssue[],
): void {
  if (!sheet.hotelName?.trim()) {
    issues.push({
      level: "error",
      field: "hotelName",
      message: "Hotel name is required.",
    });
  }

  if (!sheet.title?.trim()) {
    issues.push({
      level: "error",
      field: "title",
      message: "Rate-sheet title or bundle name is required.",
    });
  }

  if (!sheet.from || !isIsoDate(sheet.from)) {
    issues.push({
      level: "error",
      field: "from",
      message: "Start date is required and must be ISO or Jalali.",
    });
  }

  if (!sheet.to || !isIsoDate(sheet.to)) {
    issues.push({
      level: "error",
      field: "to",
      message: "End date is required and must be ISO or Jalali.",
    });
  }

  if (sheet.rows.length === 0) {
    issues.push({
      level: "error",
      message: "No supported rate-plan price rows were found.",
    });
  }

  for (const row of sheet.rows) {
    if (!row.roomName.trim()) {
      issues.push({
        level: "error",
        rowId: row.rowId,
        field: "roomName",
        message: "Room name is required.",
      });
    }

    if (!row.ratePlanName.trim()) {
      issues.push({
        level: "error",
        rowId: row.rowId,
        field: "ratePlanName",
        message: "Rate plan is required.",
      });
    }

    if (row.genericPrice !== undefined) {
      issues.push({
        level: "error",
        rowId: row.rowId,
        field: "price",
        message:
          "Generic price is ambiguous. Use boardPrice, displayPrice, or payablePrice.",
      });
    }

    if (
      row.boardPrice === undefined &&
      row.displayPrice === undefined &&
      row.payablePrice === undefined &&
      row.genericPrice === undefined
    ) {
      issues.push({
        level: "error",
        rowId: row.rowId,
        field: "price",
        message: "At least one core price field is required.",
      });
    }
  }
}

function parseMarkdownTables(text: string): ParsedTable[] {
  const lines = text.split(/\r?\n/);
  const tables: ParsedTable[] = [];
  let index = 0;

  while (index < lines.length) {
    const header = lines[index]?.trim();
    const separator = lines[index + 1]?.trim();
    if (
      !header?.includes("|") ||
      !separator ||
      !isMarkdownSeparator(separator)
    ) {
      index += 1;
      continue;
    }

    const rows: string[][] = [];
    index += 2;
    while (index < lines.length && lines[index]?.includes("|")) {
      const line = lines[index]?.trim();
      if (line && !isMarkdownSeparator(line)) {
        rows.push(splitMarkdownRow(line));
      }
      index += 1;
    }

    tables.push({
      headers: splitMarkdownRow(header),
      rows,
    });
  }

  return tables;
}

function splitMarkdownRow(line: string): string[] {
  return line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isMarkdownSeparator(line: string): boolean {
  return /^[\s|:-]+$/.test(line);
}

export function normalizeDate(value: string | undefined): string | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  const normalizedValue = toEnglishDigits(value).trim().replace(/\//g, "-");
  const parts = normalizedValue.split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
    return normalizedValue;
  }

  const [year, month, day] = parts;
  if (year > 1700) {
    const maybeIso: unknown = normalizedValue;
    return isIsoDate(maybeIso) ? maybeIso : normalizedValue;
  }

  const gregorian = jalaliToGregorian(year, month, day);
  return [
    String(gregorian.year).padStart(4, "0"),
    String(gregorian.month).padStart(2, "0"),
    String(gregorian.day).padStart(2, "0"),
  ].join("-");
}

export function parseOptionalNumber(
  value: string | undefined,
): number | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  const normalizedValue = toEnglishDigits(value)
    .replace(/[,%،\s]/g, "")
    .trim();
  const numberValue = Number(normalizedValue);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

export function toEnglishDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (digit) => {
    const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
    const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
    const persianIndex = persianDigits.indexOf(digit);
    if (persianIndex >= 0) {
      return String(persianIndex);
    }

    return String(arabicDigits.indexOf(digit));
  });
}

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[ي]/g, "ی")
    .replace(/[ك]/g, "ک")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function extractValue(line: string, pattern: RegExp): string | undefined {
  return line.match(pattern)?.[1]?.trim();
}

function jalaliToGregorian(
  jy: number,
  jm: number,
  jd: number,
): { year: number; month: number; day: number } {
  let days =
    -355668 +
    365 * (jy + 1595) +
    div(jy + 1595, 33) * 8 +
    div(((jy + 1595) % 33) + 3, 4) +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  let year = 400 * div(days, 146097);
  days %= 146097;

  if (days > 36524) {
    year += 100 * div(days - 1, 36524);
    days = (days - 1) % 36524;
    if (days >= 365) {
      days += 1;
    }
  }

  year += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) {
    year += div(days - 1, 365);
    days = (days - 1) % 365;
  }

  let dayOfYear = days + 1;
  const monthLengths = [
    0,
    31,
    isGregorianLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  let month = 1;
  while (month <= 12 && dayOfYear > monthLengths[month]) {
    dayOfYear -= monthLengths[month];
    month += 1;
  }

  return { year, month, day: dayOfYear };
}

function div(left: number, right: number): number {
  return Math.floor(left / right);
}

function isGregorianLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}
