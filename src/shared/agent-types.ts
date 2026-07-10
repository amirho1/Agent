export type EntityId = string | number;

export type AgentMode =
  | "knowledge_answer"
  | "pms_lookup"
  | "file_extraction"
  | "price_update_preparation"
  | "approval_required"
  | "execute_approved_action"
  | "general_chat";

export type UiActionType =
  | "show_message"
  | "show_hotel_selector"
  | "show_extracted_table"
  | "show_diff_table"
  | "show_approval_panel"
  | "show_execution_result";

export type ToolCallStatus = "success" | "error";

export type ValidationIssueLevel = "error" | "warning" | "info";

export type MatchStatus = "matched" | "low_confidence" | "not_found";

export type PriceDiffStatus = "new" | "changed" | "unchanged" | "error";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type Hotel = {
  id: EntityId;
  name: string;
  isActive?: boolean;
  [key: string]: unknown;
};

export type RoomTypeProvider = {
  id: EntityId;
  hotelId: EntityId;
  name: string;
  defaultCount?: number;
  isActive?: boolean;
  [key: string]: unknown;
};

export type RatePlan = {
  id: EntityId;
  hotelId: EntityId;
  name: string;
  mealType?: string;
  currency?: string;
  isActive?: boolean;
  [key: string]: unknown;
};

export type ChildrenCategory = {
  id: EntityId;
  hotelId: EntityId;
  name: string;
  from?: number;
  to?: number;
  [key: string]: unknown;
};

export type PriceConstraint = {
  cta?: boolean;
  ctd?: boolean;
  minLos?: number;
  maxLos?: number;
  stopSell?: boolean;
};

export type ChildrenPrice = {
  childrenCategoryId: EntityId;
  amount: number;
  priceType: "FREE" | "FIXED" | "PERCENT";
};

export type PricePayload = {
  ratePlanId: EntityId;
  boardPrice?: number;
  displayPrice?: number;
  payablePrice?: number;
  extraGuestPrice?: number;
  childrenPrices?: ChildrenPrice[];
};

export type PriceCapacityRecord = {
  id?: EntityId;
  hotelId: EntityId;
  hotelProviderId?: EntityId;
  date: string;
  roomTypeProviderId: EntityId;
  count?: number;
  constraint?: PriceConstraint;
  price?: PricePayload;
  [key: string]: unknown;
};

export type ExtractedRateSheetRoom = {
  rowId: string;
  roomName: string;
  ratePlanName?: string;
  boardPrice?: number;
  displayPrice?: number;
  payablePrice?: number;
  extraGuestPrice?: number;
  count?: number;
};

export type ExtractedDateRange = {
  from: string;
  to: string;
  rooms: ExtractedRateSheetRoom[];
};

export type ExtractedRateSheet = {
  hotelName?: string;
  currency?: string;
  dateRanges: ExtractedDateRange[];
};

export type UploadedRateSheet = {
  name: string;
  type: string;
  size: number;
  text?: string;
};

export type MatchResult = {
  extractedName: string;
  matchedId?: EntityId;
  matchedName?: string;
  confidence: number;
  status: MatchStatus;
};

export type MatchedRateSheetRow = {
  id: string;
  from: string;
  to: string;
  date?: string;
  roomName: string;
  ratePlanName?: string;
  roomMatch: MatchResult;
  ratePlanMatch: MatchResult;
  boardPrice?: number;
  displayPrice?: number;
  payablePrice?: number;
  extraGuestPrice?: number;
  count?: number;
};

export type ValidationIssue = {
  level: ValidationIssueLevel;
  message: string;
  rowId?: string;
  field?: string;
};

export type PriceDiffRow = {
  id: string;
  date: string;
  roomTypeProviderId?: EntityId;
  roomName: string;
  ratePlanId?: EntityId;
  ratePlanName: string;
  oldBoardPrice?: number;
  newBoardPrice?: number;
  oldDisplayPrice?: number;
  newDisplayPrice?: number;
  oldPayablePrice?: number;
  newPayablePrice?: number;
  oldCount?: number;
  newCount?: number;
  status: PriceDiffStatus;
  issues: ValidationIssue[];
  approved?: boolean;
};

export type PriceCapacityUpsertItem = {
  date: string;
  roomTypeProviderId: EntityId;
  count?: number;
  constraint?: PriceConstraint;
  price: PricePayload;
};

export type PreparedPriceCapacityPayload = {
  hotelId: EntityId;
  items: PriceCapacityUpsertItem[];
};

export type ExecutionResult = {
  success: boolean;
  created: number;
  updated: number;
  failed: number;
  errors: string[];
  items?: PriceCapacityRecord[];
  auditId?: string;
};

export type ToolCallResult = {
  name: string;
  status: ToolCallStatus;
  result?: unknown;
  error?: string;
};

export type AgentTaskState = {
  selectedHotel?: Hotel;
  uploadedFile?: UploadedRateSheet;
  extractedRateSheet?: ExtractedRateSheet;
  matchedRows?: MatchedRateSheetRow[];
  validationIssues?: ValidationIssue[];
  diffRows?: PriceDiffRow[];
  preparedPayload?: PreparedPriceCapacityPayload;
  approvalStatus?: ApprovalStatus;
  executionResult?: ExecutionResult;
  auditId?: string;
};

export type AgentUiAction = {
  type: UiActionType;
  payload?: unknown;
};

export type AgentResponse = {
  message: string;
  mode: AgentMode;
  toolCalls?: ToolCallResult[];
  taskState?: AgentTaskState;
  uiAction?: AgentUiAction;
};

export type ProposalStatus = "PENDING" | "EXECUTED" | "REJECTED" | "FAILED";

export type PriceUpdateDirection = "increase" | "decrease";

export type PriceComparisonOperator = "gt" | "gte" | "lt" | "lte";

export type PriceUpdateIntent = {
  type: "PRICE_PERCENTAGE_UPDATE";
  hotelId: EntityId;
  percent: number;
  direction: PriceUpdateDirection;
  from?: string;
  to?: string;
  roomTypeProviderId?: number;
  roomName?: string;
  ratePlanId?: number;
  ratePlanName?: string;
  priceFilters: {
    field: "displayPrice" | "boardPrice" | "payablePrice";
    operator: PriceComparisonOperator;
    value: number;
  }[];
};

export type AgentIntent =
  | "ROOM_LIST"
  | "ROOM_FILTER"
  | "ROOM_SORT"
  | "ROOM_CREATE"
  | "ROOM_UPDATE"
  | "ROOM_DELETE"
  | "ROOM_DEACTIVATE"
  | "PRICE_CAPACITY_UPDATE"
  | "GUIDANCE"
  | "CLARIFICATION_REQUIRED";

export type AgentReadResult = {
  type: "ROOM_LIST" | "ROOM_FILTER" | "ROOM_SORT";
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

export type AgentActionDiff = {
  action?: "CREATE" | "UPDATE" | "DELETE" | "DEACTIVATE";
  rowId: string;
  entityType?: "ROOM" | "PRICE_CAPACITY";
  roomTypeProviderId?: number;
  roomName?: string;
  date?: string;
  ratePlanId?: number;
  field: string;
  oldValue: string | number | boolean | null;
  newValue: string | number | boolean | null;
};

export type RoomActionPmsPayload =
  | {
      action: "CREATE_ROOM";
      hotelId: EntityId;
      room: {
        name: string;
        defaultCount: number;
        isActive?: boolean;
        description?: string;
      };
    }
  | {
      action: "UPDATE_ROOM" | "DEACTIVATE_ROOM";
      hotelId: EntityId;
      roomId: EntityId;
      update: Partial<{
        name: string;
        defaultCount: number;
        isActive: boolean;
        description: string;
      }>;
    }
  | {
      action: "DELETE_ROOM";
      hotelId: EntityId;
      roomId: EntityId;
    };

export type AgentActionProposal = {
  type:
    | "ROOM_CREATE"
    | "ROOM_UPDATE"
    | "ROOM_DELETE"
    | "ROOM_DEACTIVATE"
    | "PRICE_CAPACITY_UPDATE"
    | "PRICE_CAPACITY_UPSERT";
  status: "PENDING_CONFIRMATION";
  title: string;
  summary: string;
  hotelId?: EntityId;
  affectedRowsCount: number;
  assumptions: string[];
  warnings: string[];
  toolCalls: {
    name: string;
    input: unknown;
    resultSummary: string;
  }[];
  diffs: AgentActionDiff[];
  pmsPayload:
    | {
        items: PriceCapacityUpsertItem[];
      }
    | RoomActionPmsPayload
    | {
        items: RoomActionPmsPayload[];
      };
};

export type StoredProposalOldValue =
  | {
      entityType?: "PRICE_CAPACITY";
      rowId: string;
      date: string;
      roomTypeProviderId: number;
      ratePlanId: number;
      boardPrice: number | null;
      displayPrice: number | null;
      payablePrice?: number | null;
    }
  | {
      entityType: "ROOM";
      rowId: string;
      hotelId: EntityId;
      roomId: EntityId;
      values: Record<string, string | number | boolean | null>;
    };
