import { performance } from "node:perf_hooks";
import type {
  AgentActionDiff,
  AgentActionProposal,
  BundleDetails,
  BundleSummary,
  EntityId,
  ExtractedRateSheet,
  Hotel,
  LamasooPriceCapacityPayload,
  LamasooPriceCapacityUpsertItem,
  MatchResult,
  MatchedRateSheetRow,
  PriceField,
  RatePlan,
  RoomRateBundle,
  RoomTypeProvider,
  StoredProposalOldValue,
  ValidationIssue,
} from "@/src/shared/agent-types";
import { priceFields } from "../../shared/agent-types";
import type { ServerConfig } from "../config";
import { expandDateRange, isIsoDate } from "../price-updates/dates";
import { parseRateSheetText } from "../rate-sheets/parser";
import {
  getDurationMs,
  logOperationError,
  logOperationEvent,
} from "../logging";
import {
  getBundle,
  listBundles,
  listHotels,
  listRatePlans,
  listRoomTypes,
} from "./client";

export type StructuredToolCall = {
  name: string;
  input: unknown;
  resultSummary: string;
  result?: unknown;
  status: "success" | "error";
  error?: string | null;
};

export type PreparedLamasooProposal = {
  proposal: AgentActionProposal;
  oldValues: StoredProposalOldValue[];
  steps: Array<{
    label: string;
    status?: "COMPLETED" | "WARNING" | "ERROR";
    detail?: unknown;
  }>;
  toolCalls: StructuredToolCall[];
};

type SelectedLamasooData = {
  hotel?: Hotel;
  bundle?: BundleSummary;
  bundleDetails?: BundleDetails;
  rooms: RoomTypeProvider[];
  ratePlans: RatePlan[];
};

type SelectionResult<T extends { id: EntityId; name: string }> = {
  value?: T;
  match: MatchResult;
};

export async function prepareLamasooRateUpdateProposal(
  config: ServerConfig,
  sourceText: string,
): Promise<PreparedLamasooProposal> {
  const startedAt = performance.now();
  logOperationEvent("proposal.prepare", "proposal.prepare.started", {
    sourceText,
    systemPromptVersion: "lamasoo-rate-update-v1",
    selectedModel: config.agentModel || null,
  });
  const steps: PreparedLamasooProposal["steps"] = [
    { label: "Read rate update request" },
  ];
  const toolCalls: StructuredToolCall[] = [];
  const { extractedRateSheet, issues } = parseRateSheetText(sourceText);
  logOperationEvent("rate_sheet.parse", "rate_sheet.parsed", {
    sourceText,
    extractedRateSheet,
    issues,
    rowCount: extractedRateSheet.rows.length,
  });
  steps.push({
    label: `Parsed ${extractedRateSheet.rows.length} rate rows`,
    status: issues.some((issue) => issue.level === "error")
      ? "WARNING"
      : "COMPLETED",
    detail: { extractedRateSheet, issues },
  });

  const hotels = await callTool(toolCalls, "lamasoo.listHotels", {}, () =>
    listHotels(config),
  );
  const hotelSelection = selectEntity(extractedRateSheet.hotelName ?? "", hotels);
  const selectionIssues = createSelectionIssues(extractedRateSheet, hotelSelection);
  let selectedData: SelectedLamasooData = {
    hotel: hotelSelection.value,
    rooms: [],
    ratePlans: [],
  };

  if (hotelSelection.value) {
    const hotelId = hotelSelection.value.id;
    const [rooms, ratePlans, bundles] = await Promise.all([
      callTool(toolCalls, "lamasoo.listRoomTypes", { hotelId }, () =>
        listRoomTypes(config, hotelId),
      ),
      callTool(toolCalls, "lamasoo.listRatePlans", { hotelId }, () =>
        listRatePlans(config, hotelId),
      ),
      callTool(toolCalls, "lamasoo.listBundles", { hotelId }, () =>
        listBundles(config, hotelId),
      ),
    ]);
    const bundleSelection = selectEntity(extractedRateSheet.title ?? "", bundles);
    selectedData = {
      hotel: hotelSelection.value,
      bundle: bundleSelection.value,
      rooms,
      ratePlans,
    };
    selectionIssues.push(
      ...createBundleSelectionIssues(extractedRateSheet, bundleSelection),
    );

    const selectedBundle = bundleSelection.value;
    if (selectedBundle) {
      selectedData.bundleDetails = await callTool(
        toolCalls,
        "lamasoo.getBundle",
        { hotelId, bundleId: selectedBundle.id },
        () => getBundle(config, hotelId, selectedBundle.id),
      );
    }
  }

  const matchedRows = matchRows(extractedRateSheet, selectedData);
  logOperationEvent("rate_sheet.match", "rate_sheet.rows_matched", {
    matchedRows,
    selectedData,
  });
  const validationIssues = [
    ...issues,
    ...selectionIssues,
    ...validateMatchedRows(extractedRateSheet, matchedRows),
  ];
  const blockingIssues = validationIssues.filter(
    (issue) => issue.level === "error",
  );
  const currentPrices = selectedData.bundleDetails
    ? indexCurrentPrices(selectedData.bundleDetails)
    : new Map<string, RoomRateBundle>();
  const { diffs, payload, oldValues, warnings } = createDiffAndPayload({
    sheet: extractedRateSheet,
    selectedData,
    matchedRows,
    validationIssues,
    currentPrices,
  });

  steps.push({
    label: `Matched ${matchedRows.length} rows against Lamasoo rooms and rate plans`,
    status: blockingIssues.length > 0 ? "WARNING" : "COMPLETED",
    detail: {
      matchedRows,
      validationIssues,
    },
  });
  steps.push({
    label: `Prepared ${payload.items.length} executable Lamasoo update items`,
    status: payload.items.length === 0 ? "WARNING" : "COMPLETED",
    detail: payload,
  });

  const proposal: AgentActionProposal = {
    type: "LAMASOO_RATE_PLAN_PRICE_UPDATE",
    status: "PENDING_CONFIRMATION",
    title:
      blockingIssues.length > 0
        ? "Clarification required for Lamasoo price update"
        : "Review Lamasoo rate-plan price update",
    summary: createSummary(payload.items.length, blockingIssues.length),
    hotelId: selectedData.hotel?.id,
    hotelName: selectedData.hotel?.name ?? extractedRateSheet.hotelName,
    bundleId: selectedData.bundle?.id,
    bundleName: selectedData.bundle?.name ?? extractedRateSheet.title,
    affectedRowsCount: payload.items.length,
    assumptions: [
      "Only boardPrice, displayPrice, and payablePrice are executable in this MVP.",
      "Date ranges are expanded into one Lamasoo upsert item per day.",
    ],
    warnings,
    toolCalls: toolCalls.map(({ name, input, resultSummary }) => ({
      name,
      input,
      resultSummary,
    })),
    diffs,
    lamasooPayload: payload,
  };
  logOperationEvent("proposal.prepare", "proposal.prepare.completed", {
    proposal,
    oldValues,
    validationIssues,
    toolCalls,
    executionTimeMs: getDurationMs(startedAt),
  });

  return {
    proposal,
    oldValues,
    steps,
    toolCalls,
  };
}

async function callTool<T>(
  toolCalls: StructuredToolCall[],
  name: string,
  input: unknown,
  operation: () => Promise<T>,
): Promise<T> {
  const startedAt = performance.now();
  logOperationEvent("agent.tool_call", "agent.tool_call.started", {
    name,
    input,
  });

  try {
    const result = await operation();
    const resultSummary = Array.isArray(result)
      ? `Fetched ${result.length} records.`
      : "Fetched record.";
    logOperationEvent("agent.tool_call", "agent.tool_call.completed", {
      name,
      input,
      resultSummary,
      result,
      status: "success",
      executionTimeMs: getDurationMs(startedAt),
    });
    toolCalls.push({
      name,
      input,
      resultSummary,
      result,
      status: "success",
    });
    return result;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Lamasoo request failed.";
    logOperationError("agent.tool_call", "agent.tool_call.failed", error, {
      name,
      input,
      resultSummary: message,
      status: "error",
      executionTimeMs: getDurationMs(startedAt),
    });
    toolCalls.push({
      name,
      input,
      resultSummary: message,
      status: "error",
      error: message,
    });
    throw error;
  }
}

function selectEntity<T extends { id: EntityId; name: string }>(
  extractedName: string,
  entities: T[],
): SelectionResult<T> {
  const match = matchName(extractedName, entities);
  const value =
    match.status === "matched"
      ? entities.find((entity) => String(entity.id) === String(match.matchedId))
      : undefined;

  return { value, match };
}

function createSelectionIssues(
  sheet: ExtractedRateSheet,
  hotelSelection: SelectionResult<Hotel>,
): ValidationIssue[] {
  if (hotelSelection.value) {
    return [];
  }

  return [
    {
      level: "error",
      field: "hotelName",
      message: sheet.hotelName
        ? `Hotel "${sheet.hotelName}" could not be matched confidently.`
        : "Hotel name is required.",
    },
  ];
}

function createBundleSelectionIssues(
  sheet: ExtractedRateSheet,
  bundleSelection: SelectionResult<BundleSummary>,
): ValidationIssue[] {
  if (bundleSelection.value) {
    return [];
  }

  return [
    {
      level: "error",
      field: "title",
      message: sheet.title
        ? `Bundle "${sheet.title}" could not be matched confidently.`
        : "Rate-sheet title or bundle name is required.",
    },
  ];
}

function matchRows(
  sheet: ExtractedRateSheet,
  selectedData: SelectedLamasooData,
): MatchedRateSheetRow[] {
  if (!sheet.from || !sheet.to) {
    return sheet.rows.map((row) => ({
      ...row,
      from: sheet.from ?? "",
      to: sheet.to ?? "",
      roomMatch: matchName(row.roomName, selectedData.rooms),
      ratePlanMatch: matchRatePlan(row.ratePlanName, selectedData.ratePlans),
    }));
  }

  return sheet.rows.map((row) => ({
    ...row,
    from: sheet.from as string,
    to: sheet.to as string,
    roomMatch: matchName(row.roomName, selectedData.rooms),
    ratePlanMatch: matchRatePlan(row.ratePlanName, selectedData.ratePlans),
  }));
}

function validateMatchedRows(
  sheet: ExtractedRateSheet,
  rows: MatchedRateSheetRow[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();

  if (!sheet.from || !sheet.to || !isIsoDate(sheet.from) || !isIsoDate(sheet.to)) {
    return issues;
  }

  for (const row of rows) {
    if (row.roomMatch.status !== "matched") {
      issues.push({
        level: "error",
        rowId: row.rowId,
        field: "roomName",
        message: `Room "${row.roomName}" could not be matched confidently.`,
      });
    }

    if (row.ratePlanMatch.status !== "matched") {
      issues.push({
        level: "error",
        rowId: row.rowId,
        field: "ratePlanName",
        message: `Rate plan "${row.ratePlanName}" could not be matched confidently.`,
      });
    }

    if (
      row.roomMatch.status !== "matched" ||
      row.ratePlanMatch.status !== "matched"
    ) {
      continue;
    }

    for (const date of expandDateRange(sheet.from, sheet.to)) {
      const key = [
        date,
        row.roomMatch.matchedId,
        row.ratePlanMatch.matchedId,
      ].join(":");
      if (seen.has(key)) {
        issues.push({
          level: "error",
          rowId: row.rowId,
          message: "Duplicate room/date/rate-plan update found.",
        });
      }
      seen.add(key);
    }
  }

  return issues;
}

function createDiffAndPayload(input: {
  sheet: ExtractedRateSheet;
  selectedData: SelectedLamasooData;
  matchedRows: MatchedRateSheetRow[];
  validationIssues: ValidationIssue[];
  currentPrices: Map<string, RoomRateBundle>;
}): {
  diffs: AgentActionDiff[];
  payload: LamasooPriceCapacityPayload;
  oldValues: StoredProposalOldValue[];
  warnings: string[];
} {
  const diffs: AgentActionDiff[] = [];
  const oldValues: StoredProposalOldValue[] = [];
  const items: LamasooPriceCapacityUpsertItem[] = [];
  const warnings = new Set<string>();
  const sheetHasBlockingIssue = input.validationIssues.some(
    (issue) => issue.level === "error" && !issue.rowId,
  );

  for (const row of input.matchedRows) {
    if (row.ignoredFields.length > 0) {
      warnings.add(
        "Extra guest, child price, capacity, and meal text columns are ignored in this MVP.",
      );
    }

    const rowIssues = input.validationIssues.filter(
      (issue) => issue.rowId === row.rowId,
    );
    const rowHasBlockingIssue =
      sheetHasBlockingIssue || rowIssues.some((issue) => issue.level === "error");
    const dates =
      isIsoDate(row.from) && isIsoDate(row.to) ? expandDateRange(row.from, row.to) : [row.from];

    for (const date of dates) {
      const diffCountBefore = diffs.length;
      const current = input.currentPrices.get(
        buildCurrentPriceKey(row.roomMatch.matchedId, row.ratePlanMatch.matchedId),
      );
      const changedFields = getChangedPriceFields(row, current);

      for (const field of priceFields) {
        const newValue = row[field];
        if (newValue === undefined) {
          continue;
        }

        const oldValue = current?.[field] ?? null;
        if (oldValue === null) {
          warnings.add(
            `${field} old value is unavailable for one or more matched bundle rows.`,
          );
        }
        oldValues.push({
          rowId: buildRowId(date, row),
          date,
          roomTypeProviderId: row.roomMatch.matchedId ?? "",
          ratePlanId: row.ratePlanMatch.matchedId ?? "",
          field,
          value: oldValue,
        });
        diffs.push({
          rowId: buildRowId(date, row),
          hotelId: input.selectedData.hotel?.id,
          hotelName: input.selectedData.hotel?.name,
          roomTypeProviderId: row.roomMatch.matchedId,
          roomName: row.roomMatch.matchedName ?? row.roomName,
          ratePlanId: row.ratePlanMatch.matchedId,
          ratePlanName: row.ratePlanMatch.matchedName ?? row.ratePlanName,
          date,
          field,
          oldValue,
          newValue,
          status: rowHasBlockingIssue
            ? "error"
            : oldValue === null
              ? "new"
              : oldValue === newValue
                ? "unchanged"
                : "changed",
          issues: rowIssues,
        });
      }

      if (diffs.length === diffCountBefore && rowHasBlockingIssue) {
        diffs.push({
          rowId: buildRowId(date, row),
          hotelId: input.selectedData.hotel?.id,
          hotelName: input.selectedData.hotel?.name,
          roomTypeProviderId: row.roomMatch.matchedId,
          roomName: row.roomMatch.matchedName ?? row.roomName,
          ratePlanId: row.ratePlanMatch.matchedId,
          ratePlanName: row.ratePlanMatch.matchedName ?? row.ratePlanName,
          date,
          field: row.roomMatch.status !== "matched" ? "match" : "price",
          oldValue: null,
          newValue: null,
          status: "error",
          issues: rowIssues,
        });
      }

      if (
        !rowHasBlockingIssue &&
        row.roomMatch.matchedId !== undefined &&
        row.ratePlanMatch.matchedId !== undefined &&
        changedFields.length > 0
      ) {
        items.push({
          date,
          roomTypeProviderId: row.roomMatch.matchedId,
          price: changedFields.reduce<LamasooPriceCapacityUpsertItem["price"]>(
            (price, field) => ({
              ...price,
              [field]: row[field],
            }),
            { ratePlanId: row.ratePlanMatch.matchedId },
          ),
        });
      }
    }
  }

  if (items.length === 0) {
    warnings.add("No executable Lamasoo update items were prepared.");
  }

  return {
    diffs,
    payload: {
      hotelId: input.selectedData.hotel?.id ?? "",
      bundleId: input.selectedData.bundle?.id,
      items,
    },
    oldValues,
    warnings: Array.from(warnings),
  };
}

function getChangedPriceFields(
  row: MatchedRateSheetRow,
  current: RoomRateBundle | undefined,
): PriceField[] {
  return priceFields.filter((field) => {
    const newValue = row[field];
    if (newValue === undefined) {
      return false;
    }

    return current?.[field] === undefined || current[field] !== newValue;
  });
}

function indexCurrentPrices(bundle: BundleDetails): Map<string, RoomRateBundle> {
  const currentPrices = new Map<string, RoomRateBundle>();
  for (const ratePlan of bundle.ratePlans ?? []) {
    for (const roomRateBundle of ratePlan.roomRateBundles ?? []) {
      currentPrices.set(
        buildCurrentPriceKey(
          roomRateBundle.roomTypeProviderId,
          roomRateBundle.ratePlanId ?? ratePlan.ratePlanId,
        ),
        {
          ...roomRateBundle,
          ratePlanId: roomRateBundle.ratePlanId ?? ratePlan.ratePlanId,
        },
      );
    }
  }

  return currentPrices;
}

export function findCurrentBundlePrice(
  bundle: BundleDetails,
  roomTypeProviderId: EntityId,
  ratePlanId: EntityId,
): RoomRateBundle | undefined {
  return indexCurrentPrices(bundle).get(
    buildCurrentPriceKey(roomTypeProviderId, ratePlanId),
  );
}

function buildCurrentPriceKey(
  roomTypeProviderId: EntityId | undefined,
  ratePlanId: EntityId | undefined,
): string {
  return [roomTypeProviderId ?? "", ratePlanId ?? ""].join(":");
}

function buildRowId(date: string, row: MatchedRateSheetRow): string {
  return [date, row.roomMatch.matchedId ?? row.roomName, row.ratePlanMatch.matchedId ?? row.ratePlanName].join(":");
}

function createSummary(itemCount: number, issueCount: number): string {
  if (issueCount > 0) {
    return `${issueCount} issue${issueCount === 1 ? "" : "s"} must be resolved before any Lamasoo update can run.`;
  }

  return `${itemCount} Lamasoo price update item${itemCount === 1 ? "" : "s"} prepared for review.`;
}

export function matchRatePlan(
  extractedName: string,
  ratePlans: RatePlan[],
): MatchResult {
  const normalizedInput = normalizeName(extractedName).toUpperCase();
  const mealTypeMatches = ratePlans.filter(
    (plan) => plan.mealType?.toUpperCase() === normalizedInput,
  );

  if (mealTypeMatches.length === 1) {
    const plan = mealTypeMatches[0];
    return {
      extractedName,
      matchedId: plan.id,
      matchedName: plan.name,
      confidence: 1,
      status: "matched",
    };
  }

  if (mealTypeMatches.length > 1) {
    return {
      extractedName,
      confidence: 1,
      status: "ambiguous",
      candidates: mealTypeMatches.map((plan) => ({
        id: plan.id,
        name: plan.name,
        confidence: 1,
      })),
    };
  }

  return matchName(extractedName, ratePlans);
}

export function matchName<T extends { id: EntityId; name: string }>(
  extractedName: string,
  entities: T[],
): MatchResult {
  if (!extractedName.trim()) {
    return { extractedName, confidence: 0, status: "not_found" };
  }

  const candidates = entities
    .map((entity) => ({
      id: entity.id,
      name: entity.name,
      confidence: calculateNameSimilarity(extractedName, entity.name),
    }))
    .sort((left, right) => right.confidence - left.confidence);
  const best = candidates[0];

  if (!best || best.confidence < 0.85) {
    return {
      extractedName,
      confidence: best?.confidence ?? 0,
      status: "not_found",
      candidates: candidates.slice(0, 3),
    };
  }

  if (candidates[1] && candidates[1].confidence >= best.confidence - 0.02) {
    return {
      extractedName,
      confidence: best.confidence,
      status: "ambiguous",
      candidates: candidates.slice(0, 3),
    };
  }

  return {
    extractedName,
    matchedId: best.id,
    matchedName: best.name,
    confidence: best.confidence,
    status: "matched",
    candidates: candidates.slice(0, 3),
  };
}

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
