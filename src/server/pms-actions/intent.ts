import type { AgentIntent, EntityId } from "@/src/shared/agent-types";

export type RoomQueryIntent = {
  type: "ROOM_LIST" | "ROOM_FILTER" | "ROOM_SORT";
  hotelId: EntityId;
  roomId?: number;
  name?: string;
  isActive?: boolean;
  noAvailability?: boolean;
  sort?: "CHEAPEST" | "MOST_EXPENSIVE";
  limit?: number;
  priceFilter?: {
    field: "displayPrice" | "boardPrice" | "payablePrice";
    operator: "gt" | "gte" | "lt" | "lte";
    value: number;
  };
};

export type RoomCreateIntent = {
  type: "ROOM_CREATE";
  hotelId: EntityId;
  name: string;
  defaultCount?: number;
};

export type RoomUpdateIntent = {
  type: "ROOM_UPDATE";
  hotelId?: EntityId;
  roomId: number;
  update: {
    name?: string;
    defaultCount?: number;
    isActive?: boolean;
  };
};

export type RoomDeleteIntent = {
  type: "ROOM_DELETE";
  hotelId?: EntityId;
  roomId: number;
};

export type RoomDeactivateIntent =
  | {
      type: "ROOM_DEACTIVATE";
      hotelId?: EntityId;
      roomId: number;
    }
  | {
      type: "ROOM_DEACTIVATE";
      hotelId: EntityId;
      noAvailability: true;
    };

export type FixedPriceUpdateIntent = {
  type: "PRICE_CAPACITY_UPDATE";
  hotelId: EntityId;
  selection: RoomQueryIntent;
  fields: Array<"displayPrice" | "boardPrice" | "payablePrice">;
  operation:
    | {
        type: "PERCENT_CHANGE" | "DELTA";
        direction: "increase" | "decrease";
        value: number;
      }
    | {
        type: "MULTIPLY" | "DIVIDE" | "SET" | "CAP_AT" | "FLOOR_AT";
        value: number;
      };
  roundTo?: number;
};

export type PriceOperationUpdateIntent = FixedPriceUpdateIntent;

export type PmsActionIntent =
  | RoomQueryIntent
  | RoomCreateIntent
  | RoomUpdateIntent
  | RoomDeleteIntent
  | RoomDeactivateIntent
  | FixedPriceUpdateIntent;

export type PmsIntentExtractionResult =
  | {
      ok: true;
      intent: PmsActionIntent;
    }
  | {
      ok: false;
      intentType: AgentIntent | "UNSUPPORTED";
      clarification?: string;
    };

const numberWords = new Map([
  ["one", 1],
  ["two", 2],
  ["three", 3],
  ["four", 4],
  ["five", 5],
  ["six", 6],
  ["seven", 7],
  ["eight", 8],
  ["nine", 9],
  ["ten", 10],
  ["eleven", 11],
  ["twelve", 12],
  ["thirteen", 13],
  ["fourteen", 14],
  ["fifteen", 15],
  ["sixteen", 16],
  ["seventeen", 17],
  ["eighteen", 18],
  ["nineteen", 19],
  ["twenty", 20],
]);

const numberTokenPattern =
  "\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty";

export function extractPmsActionIntent(
  message: string,
): PmsIntentExtractionResult {
  const normalized = message
    .toLowerCase()
    .replace(/[.?!]+$/g, "")
    .trim();

  if (mentionsPriceOperationChange(normalized)) {
    return extractPriceOperationIntent(normalized);
  }

  if (mentionsRoomCreate(normalized)) {
    return extractRoomCreateIntent(message, normalized);
  }

  if (mentionsDeactivate(normalized) && mentionsRoom(normalized)) {
    return extractRoomDeactivateIntent(normalized);
  }

  if (mentionsRoomDelete(normalized)) {
    return extractRoomDeleteIntent(normalized);
  }

  if (mentionsRoomUpdate(normalized)) {
    return extractRoomUpdateIntent(message, normalized);
  }

  if (mentionsRoomRead(normalized)) {
    return extractRoomQueryIntent(normalized);
  }

  return {
    ok: false,
    intentType: "UNSUPPORTED",
  };
}

function extractRoomCreateIntent(
  originalMessage: string,
  normalized: string,
): PmsIntentExtractionResult {
  const hotelId = extractHotelId(normalized);
  if (!hotelId) {
    return {
      ok: false,
      intentType: "ROOM_CREATE",
      clarification: "Which hotel ID should I add the room to?",
    };
  }

  const name = extractRoomCreateName(originalMessage);
  if (!name) {
    return {
      ok: false,
      intentType: "ROOM_CREATE",
      clarification: "What should the new room be named?",
    };
  }

  return {
    ok: true,
    intent: {
      type: "ROOM_CREATE",
      hotelId,
      name,
      defaultCount: extractDefaultCount(normalized),
    },
  };
}

function extractRoomUpdateIntent(
  originalMessage: string,
  normalized: string,
): PmsIntentExtractionResult {
  const roomId = extractRoomId(normalized);
  if (!roomId) {
    return {
      ok: false,
      intentType: "ROOM_UPDATE",
      clarification: "Which room ID should I edit?",
    };
  }

  const update: RoomUpdateIntent["update"] = {};
  const nameMatch = originalMessage.match(
    /room\s+\d+\s+name\s+(?:to|as)\s+(.+?)[.?!]?$/i,
  );
  if (nameMatch?.[1]) {
    update.name = nameMatch[1].trim();
  }

  const defaultCount = extractDefaultCount(normalized);
  if (defaultCount !== undefined) {
    update.defaultCount = defaultCount;
  }

  if (/active\s+(?:to\s+)?true|activate/.test(normalized)) {
    update.isActive = true;
  }

  if (/active\s+(?:to\s+)?false|deactivate/.test(normalized)) {
    update.isActive = false;
  }

  if (Object.keys(update).length === 0) {
    return {
      ok: false,
      intentType: "ROOM_UPDATE",
      clarification:
        "Which room field should I change, and what is the new value?",
    };
  }

  return {
    ok: true,
    intent: {
      type: "ROOM_UPDATE",
      hotelId: extractHotelId(normalized),
      roomId,
      update,
    },
  };
}

function extractRoomDeleteIntent(
  normalized: string,
): PmsIntentExtractionResult {
  const roomId = extractRoomId(normalized);
  if (!roomId) {
    return {
      ok: false,
      intentType: "ROOM_DELETE",
      clarification: "Which room ID should I delete?",
    };
  }

  return {
    ok: true,
    intent: {
      type: "ROOM_DELETE",
      hotelId: extractHotelId(normalized),
      roomId,
    },
  };
}

function extractRoomDeactivateIntent(
  normalized: string,
): PmsIntentExtractionResult {
  const roomId = extractRoomId(normalized);
  if (/no availability|no available|without availability/.test(normalized)) {
    const hotelId = extractHotelId(normalized);
    if (!hotelId) {
      return {
        ok: false,
        intentType: "ROOM_DEACTIVATE",
        clarification:
          "Which hotel ID should I check for rooms with no availability?",
      };
    }

    return {
      ok: true,
      intent: {
        type: "ROOM_DEACTIVATE",
        hotelId,
        noAvailability: true,
      },
    };
  }

  if (!roomId) {
    return {
      ok: false,
      intentType: "ROOM_DEACTIVATE",
      clarification: "Which room ID should I deactivate?",
    };
  }

  return {
    ok: true,
    intent: {
      type: "ROOM_DEACTIVATE",
      hotelId: extractHotelId(normalized),
      roomId,
    },
  };
}

function extractPriceOperationIntent(
  normalized: string,
): PmsIntentExtractionResult {
  const hotelId = extractHotelId(normalized);
  if (!hotelId) {
    return {
      ok: false,
      intentType: "PRICE_CAPACITY_UPDATE",
      clarification: "Which hotel ID should I update prices for?",
    };
  }

  const operation = extractPriceOperation(normalized);
  if (!operation) {
    return {
      ok: false,
      intentType: "PRICE_CAPACITY_UPDATE",
      clarification:
        "How should I change the price? For example: multiply by 2, add 3 dollars, or set display price to 100.",
    };
  }

  const fields = extractPriceFields(normalized);
  if (fields.length === 0) {
    return {
      ok: false,
      intentType: "PRICE_CAPACITY_UPDATE",
      clarification: "Which price field should I update?",
    };
  }

  const selection = buildRoomQueryIntent(normalized, hotelId);

  return {
    ok: true,
    intent: {
      type: "PRICE_CAPACITY_UPDATE",
      hotelId,
      selection,
      fields,
      operation,
      roundTo: extractRoundTo(normalized),
    },
  };
}

function extractRoomQueryIntent(normalized: string): PmsIntentExtractionResult {
  const hotelId = extractHotelId(normalized);
  if (!hotelId) {
    return {
      ok: false,
      intentType: "ROOM_LIST",
      clarification: "Which hotel ID should I show rooms for?",
    };
  }

  return {
    ok: true,
    intent: buildRoomQueryIntent(normalized, hotelId),
  };
}

function buildRoomQueryIntent(
  normalized: string,
  hotelId: EntityId,
): RoomQueryIntent {
  const sort = extractSort(normalized);
  const priceFilter = extractPriceFilter(normalized);
  const noAvailability =
    /no availability|no available|without availability/.test(normalized);
  const type: RoomQueryIntent["type"] = sort
    ? "ROOM_SORT"
    : priceFilter || noAvailability || extractRoomName(normalized)
      ? "ROOM_FILTER"
      : "ROOM_LIST";

  return {
    type,
    hotelId,
    roomId: extractRoomId(normalized),
    name: extractRoomName(normalized),
    isActive: extractActiveFilter(normalized),
    noAvailability,
    sort,
    limit: extractLimit(normalized),
    priceFilter,
  };
}

function mentionsRoomCreate(message: string): boolean {
  return (
    /\b(add|create)\b/.test(message) &&
    (mentionsRoom(message) ||
      /default\s+count|(?:to|for)\s+hotel\s+\d+/.test(message))
  );
}

function mentionsRoomUpdate(message: string): boolean {
  return /\b(edit|update|change)\b/.test(message) && mentionsRoom(message);
}

function mentionsRoomDelete(message: string): boolean {
  return /\b(delete|remove)\b/.test(message) && mentionsRoom(message);
}

function mentionsRoomRead(message: string): boolean {
  return (
    (/\b(show|list|find|filter|first|top)\b/.test(message) ||
      /\ball\s+rooms?\b/.test(message)) &&
    mentionsRoom(message)
  );
}

function mentionsRoom(message: string): boolean {
  return /\brooms?\b/.test(message);
}

function mentionsDeactivate(message: string): boolean {
  return /\bdeactivate|make inactive\b/.test(message);
}

function mentionsPriceOperationChange(message: string): boolean {
  return (
    /\b(price|prices|display\s*price|displayprice|board\s*price|boardprice|payable\s*price|payableprice)\b/.test(
      message,
    ) &&
    /\b(add|increase|raise|bump|reduce|decrease|lower|multiply|multiplying|divide|dividing|set|cap|floor|percent|%)\b/.test(
      message,
    )
  );
}

function mentionsDecrease(message: string): boolean {
  return /\b(reduce|decrease|lower)\b/.test(message);
}

function extractHotelId(message: string): number | undefined {
  return extractPositiveInteger(message, /hotel\s*(?:id\s*)?(\d+)/i);
}

function extractRoomId(message: string): number | undefined {
  return extractPositiveInteger(message, /room\s*(?:id\s*)?(\d+)/i);
}

function extractDefaultCount(message: string): number | undefined {
  return extractPositiveInteger(message, /default\s+count\s*(?:to\s*)?(\d+)/i);
}

function extractMoneyAmount(message: string): number | undefined {
  const match = message.match(
    /(?:\$|add|increase|raise|bump|reduce|decrease|lower)\s*(\d+(?:\.\d+)?)\s*(?:dollars?|usd)?|(\d+(?:\.\d+)?)\s*(?:dollars?|usd)/i,
  );
  const rawValue = match?.[1] ?? match?.[2];
  if (!rawValue) {
    return undefined;
  }

  const value = Number(rawValue);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function extractPriceOperation(
  message: string,
): FixedPriceUpdateIntent["operation"] | undefined {
  const multiply = message.match(
    /\b(?:multiply|multiplying)\b(?:\s+\w+){0,4}?\s+(?:by|with|x|times)\s+(\d+(?:\.\d+)?)/,
  );
  if (multiply?.[1]) {
    return { type: "MULTIPLY", value: Number(multiply[1]) };
  }

  const divide = message.match(
    /\b(?:divide|dividing)\b(?:\s+\w+){0,4}?\s+(?:by|with)\s+(\d+(?:\.\d+)?)/,
  );
  if (divide?.[1]) {
    return { type: "DIVIDE", value: Number(divide[1]) };
  }

  const set = message.match(
    /\bset\b(?:\s+\w+){0,5}?\s+(?:to|at)\s+(\d+(?:\.\d+)?)/,
  );
  if (set?.[1]) {
    return { type: "SET", value: Number(set[1]) };
  }

  const cap = message.match(
    /\bcap\b(?:\s+\w+){0,5}?\s+(?:to|at)\s+(\d+(?:\.\d+)?)/,
  );
  if (cap?.[1]) {
    return { type: "CAP_AT", value: Number(cap[1]) };
  }

  const floor = message.match(
    /\bfloor\b(?:\s+\w+){0,5}?\s+(?:to|at)\s+(\d+(?:\.\d+)?)/,
  );
  if (floor?.[1]) {
    return { type: "FLOOR_AT", value: Number(floor[1]) };
  }

  const percent = message.match(
    /(\d+(?:\.\d+)?)\s*%|(\d+(?:\.\d+)?)\s*percent/i,
  );
  const percentValue = Number(percent?.[1] ?? percent?.[2]);
  if (Number.isFinite(percentValue) && percentValue > 0) {
    return {
      type: "PERCENT_CHANGE",
      direction: mentionsDecrease(message) ? "decrease" : "increase",
      value: percentValue,
    };
  }

  const amount = extractMoneyAmount(message);
  if (amount) {
    return {
      type: "DELTA",
      direction: mentionsDecrease(message) ? "decrease" : "increase",
      value: amount,
    };
  }

  return undefined;
}

function extractPriceFields(message: string): FixedPriceUpdateIntent["fields"] {
  if (/all\s+prices|all\s+price\s+fields/.test(message)) {
    return ["boardPrice", "displayPrice", "payablePrice"];
  }

  const fields: FixedPriceUpdateIntent["fields"] = [];
  if (/display\s*price|displayprice/.test(message)) {
    fields.push("displayPrice");
  }

  if (/board\s*price|boardprice/.test(message)) {
    fields.push("boardPrice");
  }

  if (/payable\s*price|payableprice/.test(message)) {
    fields.push("payablePrice");
  }

  if (fields.length > 0) {
    return fields;
  }

  return [];
}

function extractRoundTo(message: string): number | undefined {
  return extractPositiveInteger(message, /round(?:ed)?\s+to\s+(\d+)/i);
}

function extractRoomCreateName(message: string): string | undefined {
  const namedMatch = message.match(
    /(?:named|called)\s+(.+?)\s+(?:to|for)\s+hotel\s+\d+/i,
  );
  const addMatch = message.match(
    /\badd\s+(?:a\s+new\s+room\s+)?(.+?)\s+(?:to|for)\s+hotel\s+\d+/i,
  );
  const rawName = namedMatch?.[1] ?? addMatch?.[1];
  const name = rawName
    ?.replace(/^room\s+/i, "")
    .replace(/\s+with\s+default\s+count.*$/i, "")
    .trim();

  return name || undefined;
}

function extractRoomName(message: string): string | undefined {
  const explicitMatch = message.match(
    /room\s+name\s+(?:contains\s+)?([a-z0-9\s-]+)/i,
  );
  if (explicitMatch?.[1]) {
    return cleanNameFilter(explicitMatch[1]);
  }

  const allRoomsMatch = message.match(
    /all\s+(?!prices?\b|price\s+fields?\b)([a-z0-9\s-]+?)\s+rooms?\b/i,
  );
  if (allRoomsMatch?.[1]) {
    return cleanNameFilter(allRoomsMatch[1]);
  }

  const descriptiveRoomsMatch = message.match(/\b([a-z]+)\s+rooms?\b/i);
  if (descriptiveRoomsMatch?.[1]) {
    const value = cleanNameFilter(descriptiveRoomsMatch[1]);
    return !value ||
      [
        "show",
        "list",
        "find",
        "hotel",
        "all",
        "the",
        "increase",
        "raise",
        "bump",
        "reduce",
        "decrease",
        "lower",
        "update",
        "change",
        "price",
        "prices",
        "first",
        "top",
      ].includes(value)
      ? undefined
      : value;
  }

  return undefined;
}

function cleanNameFilter(value: string): string {
  return value
    .replace(/\b(active|inactive|cheapest|expensive|most|least)\b/g, "")
    .trim();
}

function extractActiveFilter(message: string): boolean | undefined {
  if (/\binactive\b/.test(message)) {
    return false;
  }

  if (/\bactive\b/.test(message)) {
    return true;
  }

  return undefined;
}

function extractSort(message: string): RoomQueryIntent["sort"] {
  if (/cheapest|lowest\s+price/.test(message)) {
    return "CHEAPEST";
  }

  if (/most\s+expensive|highest\s+price/.test(message)) {
    return "MOST_EXPENSIVE";
  }

  return undefined;
}

function extractLimit(message: string): number | undefined {
  const searchableMessage = message.replace(/hotel\s*(?:id\s*)?\d+/gi, "hotel");
  const patterns = [
    new RegExp(`\\bfirst\\s+(${numberTokenPattern})\\s+rooms?\\b`, "i"),
    new RegExp(
      `\\b(${numberTokenPattern})\\s+(?:cheapest|most\\s+expensive|rooms?)\\b`,
      "i",
    ),
    new RegExp(
      `\\b(?:cheapest|most\\s+expensive|top|limit|first)\\s+(${numberTokenPattern})\\b`,
      "i",
    ),
  ];

  for (const pattern of patterns) {
    const match = searchableMessage.match(pattern);
    const value = parseNumberToken(match?.[1]);
    if (value) {
      return value;
    }
  }

  return undefined;
}

function extractPriceField(
  message: string,
): "displayPrice" | "boardPrice" | "payablePrice" | undefined {
  if (/display\s*price|displayprice/.test(message)) {
    return "displayPrice";
  }

  if (/board\s*price|boardprice/.test(message)) {
    return "boardPrice";
  }

  if (/payable\s*price|payableprice/.test(message)) {
    return "payablePrice";
  }

  return undefined;
}

function extractPriceFilter(message: string): RoomQueryIntent["priceFilter"] {
  const field = extractPriceField(message) ?? "displayPrice";
  const comparisons: Array<{
    operator: NonNullable<RoomQueryIntent["priceFilter"]>["operator"];
    pattern: RegExp;
  }> = [
    {
      operator: "gte",
      pattern:
        /(?:greater than or equal to|more than or equal to|at least)\s+(\d+(?:\.\d+)?)/,
    },
    {
      operator: "lte",
      pattern:
        /(?:less than or equal to|lower than or equal to|at most)\s+(\d+(?:\.\d+)?)/,
    },
    {
      operator: "gt",
      pattern: /(?:more than|greater than|over|above)\s+(\d+(?:\.\d+)?)/,
    },
    {
      operator: "lt",
      pattern: /(?:less than|lower than|under|below)\s+(\d+(?:\.\d+)?)/,
    },
  ];

  if (!/\bprice\b|displayprice|boardprice|payableprice/.test(message)) {
    return undefined;
  }

  for (const comparison of comparisons) {
    const match = message.match(comparison.pattern);
    if (!match?.[1]) {
      continue;
    }

    const value = Number(match[1]);
    if (Number.isFinite(value)) {
      return {
        field,
        operator: comparison.operator,
        value,
      };
    }
  }

  return undefined;
}

function extractPositiveInteger(
  message: string,
  pattern: RegExp,
): number | undefined {
  const match = message.match(pattern);
  return parseNumberToken(match?.[1]);
}

function parseNumberToken(token: string | undefined): number | undefined {
  if (!token) {
    return undefined;
  }

  const normalized = token.toLowerCase();
  const wordValue = numberWords.get(normalized);
  if (wordValue) {
    return wordValue;
  }

  const value = Number(token);
  return Number.isInteger(value) && value > 0 ? value : undefined;
}
