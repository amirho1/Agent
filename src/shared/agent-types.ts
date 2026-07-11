export type EntityId = string | number;

export type ValidationIssueLevel = "error" | "warning" | "info";

export type MatchStatus = "matched" | "ambiguous" | "not_found";

export type ProposalStatus = "PENDING" | "EXECUTED" | "REJECTED" | "FAILED";

export type PriceField = "boardPrice" | "displayPrice" | "payablePrice";

export const priceFields: PriceField[] = [
  "boardPrice",
  "displayPrice",
  "payablePrice",
];

export type Hotel = {
  id: EntityId;
  name: string;
  isActive?: boolean;
  [key: string]: unknown;
};

export type RoomTypeProvider = {
  id: EntityId;
  hotelProviderId?: EntityId;
  hotelId?: EntityId;
  name: string;
  defaultCount?: number;
  isActive?: boolean;
  [key: string]: unknown;
};

export type RatePlan = {
  id: EntityId;
  hotelProviderId?: EntityId;
  hotelId?: EntityId;
  name: string;
  mealType?: string;
  currency?: string;
  isActive?: boolean;
  [key: string]: unknown;
};

export type BundleSummary = {
  id: EntityId;
  name: string;
  type?: string;
  hotelProviderId?: EntityId;
  [key: string]: unknown;
};

export type RoomRateBundle = {
  id?: EntityId;
  bundleId?: EntityId;
  ratePlanId: EntityId;
  roomTypeProviderId: EntityId;
  boardPrice?: number;
  displayPrice?: number;
  payablePrice?: number;
  roomTypeProvider?: RoomTypeProvider;
  [key: string]: unknown;
};

export type BundleRatePlan = {
  ratePlanId: EntityId;
  name: string;
  mealType?: string;
  currency?: string;
  roomRateBundles: RoomRateBundle[];
  [key: string]: unknown;
};

export type BundleDetails = BundleSummary & {
  ratePlans: BundleRatePlan[];
};

export type ExtractedRateSheetRow = {
  rowId: string;
  roomName: string;
  ratePlanName: string;
  boardPrice?: number;
  displayPrice?: number;
  payablePrice?: number;
  genericPrice?: number;
  ignoredFields: string[];
};

export type ExtractedRateSheet = {
  hotelName?: string;
  title?: string;
  currency?: string;
  from?: string;
  to?: string;
  rows: ExtractedRateSheetRow[];
};

export type MatchResult = {
  extractedName: string;
  matchedId?: EntityId;
  matchedName?: string;
  confidence: number;
  status: MatchStatus;
  candidates?: Array<{
    id: EntityId;
    name: string;
    confidence: number;
  }>;
};

export type ValidationIssue = {
  level: ValidationIssueLevel;
  message: string;
  rowId?: string;
  field?: string;
};

export type MatchedRateSheetRow = ExtractedRateSheetRow & {
  from: string;
  to: string;
  roomMatch: MatchResult;
  ratePlanMatch: MatchResult;
};

export type LamasooPricePayload = {
  ratePlanId: EntityId;
  boardPrice?: number;
  displayPrice?: number;
  payablePrice?: number;
};

export type LamasooPriceCapacityUpsertItem = {
  date: string;
  roomTypeProviderId: EntityId;
  price: LamasooPricePayload;
};

export type LamasooPriceCapacityPayload = {
  hotelId: EntityId;
  bundleId?: EntityId;
  items: LamasooPriceCapacityUpsertItem[];
};

export type AgentActionDiff = {
  rowId: string;
  hotelName?: string;
  hotelId?: EntityId;
  roomTypeProviderId?: EntityId;
  roomName?: string;
  ratePlanId?: EntityId;
  ratePlanName?: string;
  date?: string;
  field: PriceField | "match" | "date" | "price";
  oldValue: string | number | boolean | null;
  newValue: string | number | boolean | null;
  status?: "new" | "changed" | "unchanged" | "error";
  issues?: ValidationIssue[];
};

export type AgentActionProposal = {
  type: "LAMASOO_RATE_PLAN_PRICE_UPDATE";
  status: "PENDING_CONFIRMATION";
  title: string;
  summary: string;
  hotelId?: EntityId;
  hotelName?: string;
  bundleId?: EntityId;
  bundleName?: string;
  affectedRowsCount: number;
  assumptions: string[];
  warnings: string[];
  toolCalls: {
    name: string;
    input: unknown;
    resultSummary: string;
  }[];
  diffs: AgentActionDiff[];
  lamasooPayload: LamasooPriceCapacityPayload;
};

export type StoredProposalOldValue = {
  rowId: string;
  date: string;
  roomTypeProviderId: EntityId;
  ratePlanId: EntityId;
  field: PriceField;
  value: number | null;
};

export type LamasooExecutionResult = {
  success: boolean;
  result?: unknown;
};

export type AgentReadResult = {
  type: "LAMASOO_RATE_PLAN_PRICE_UPDATE";
  title: string;
  summary: string;
  hotelId?: EntityId;
  matchedRowsCount: number;
  columns: string[];
  rows: Record<string, unknown>[];
  toolCalls: {
    name: string;
    input: unknown;
    resultSummary: string;
  }[];
};
