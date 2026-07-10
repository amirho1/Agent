import type { PriceUpdateIntent } from "@/src/shared/agent-types";
import { priceUpdateIntentSchema } from "./schemas";

export type IntentExtractionResult =
  | {
      ok: true;
      intent: PriceUpdateIntent;
    }
  | {
      ok: false;
      isPriceUpdateRequest: boolean;
      clarification?: string;
    };

const isoDatePattern = /\d{4}-\d{2}-\d{2}/g;

export function extractPriceUpdateIntent(
  message: string,
): IntentExtractionResult {
  const normalizedMessage = message.toLowerCase();
  const isPriceUpdateRequest =
    mentionsPrice(normalizedMessage) && mentionsChange(normalizedMessage);

  if (!isPriceUpdateRequest) {
    return { ok: false, isPriceUpdateRequest: false };
  }

  const hotelId = extractPositiveInteger(
    normalizedMessage,
    /hotel\s*(?:id\s*)?(\d+)/i,
  );
  if (!hotelId) {
    return {
      ok: false,
      isPriceUpdateRequest: true,
      clarification: "Which hotel ID should I update prices for?",
    };
  }

  const percent = extractPercent(normalizedMessage);
  if (!percent) {
    return {
      ok: false,
      isPriceUpdateRequest: true,
      clarification: "What percentage should I use for the price change?",
    };
  }

  const direction = mentionsDecrease(normalizedMessage)
    ? "decrease"
    : "increase";
  const dates = Array.from(message.matchAll(isoDatePattern)).map(
    (match) => match[0],
  );
  const roomTypeProviderId = extractPositiveInteger(
    normalizedMessage,
    /room(?:\s*type)?(?:\s*provider)?(?:\s*id)?\s*(\d+)/i,
  );
  const roomName = extractRoomNameFilter(normalizedMessage);
  const ratePlanId = extractPositiveInteger(
    normalizedMessage,
    /rate\s*plan(?:\s*id)?\s*(\d+)/i,
  );

  const parsed = priceUpdateIntentSchema.parse({
    type: "PRICE_PERCENTAGE_UPDATE",
    hotelId,
    percent,
    direction,
    from: dates[0],
    to: dates[1],
    roomTypeProviderId,
    roomName,
    ratePlanId,
    priceFilters: extractPriceFilters(normalizedMessage),
  });

  return {
    ok: true,
    intent: parsed,
  };
}

function extractRoomNameFilter(message: string): string | undefined {
  const allRoomsMatch = message.match(/all\s+([a-z0-9\s-]+?)\s+rooms?\b/i);
  const namedRoomsMatch = message.match(/(?:for|of)\s+([a-z0-9\s-]+?)\s+rooms?\b/i);
  const rawValue = allRoomsMatch?.[1] ?? namedRoomsMatch?.[1];
  const value = rawValue?.trim();

  if (!value || ["hotel", "room", "price", "prices"].includes(value)) {
    return undefined;
  }

  return value;
}

function mentionsPrice(message: string): boolean {
  return /price|prices|boardprice|displayprice|payableprice|قیمت/.test(message);
}

function mentionsChange(message: string): boolean {
  return /increase|raise|bump|decrease|reduce|lower|update|change|افزایش|کاهش/.test(
    message,
  );
}

function mentionsDecrease(message: string): boolean {
  return /decrease|reduce|lower|کاهش/.test(message);
}

function extractPercent(message: string): number | undefined {
  const match = message.match(/(\d+(?:\.\d+)?)\s*%|(\d+(?:\.\d+)?)\s*percent/i);
  const rawValue = match?.[1] ?? match?.[2];
  if (!rawValue) {
    return undefined;
  }

  const value = Number(rawValue);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function extractPositiveInteger(
  message: string,
  pattern: RegExp,
): number | undefined {
  const match = message.match(pattern);
  if (!match?.[1]) {
    return undefined;
  }

  const value = Number(match[1]);
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

function extractPriceFilters(
  message: string,
): PriceUpdateIntent["priceFilters"] {
  const filters: PriceUpdateIntent["priceFilters"] = [];
  const field = extractFilterField(message);
  const comparison = extractComparison(message);

  if (!field || !comparison) {
    return filters;
  }

  filters.push({
    field,
    operator: comparison.operator,
    value: comparison.value,
  });

  return filters;
}

function extractFilterField(
  message: string,
): PriceUpdateIntent["priceFilters"][number]["field"] | undefined {
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

function extractComparison(
  message: string,
): Pick<PriceUpdateIntent["priceFilters"][number], "operator" | "value"> | null {
  const comparisons: Array<{
    operator: PriceUpdateIntent["priceFilters"][number]["operator"];
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

  for (const comparison of comparisons) {
    const match = message.match(comparison.pattern);
    if (!match?.[1]) {
      continue;
    }

    const value = Number(match[1]);
    if (Number.isFinite(value)) {
      return {
        operator: comparison.operator,
        value,
      };
    }
  }

  return null;
}
