import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import type { ServerConfig } from "../config";
import { assertAgentLlmConfig } from "../config";
import { createAgentLlm } from "../agent/llm";
import type {
  FixedPriceUpdateIntent,
  PmsIntentExtractionResult,
  RoomQueryIntent,
} from "./intent";

const priceFieldSchema = z.enum(["displayPrice", "boardPrice", "payablePrice"]);

const roomQueryIntentShape = z
  .object({
    hotelId: z.union([z.string(), z.number()]).optional(),
    roomId: z.number().int().positive().optional(),
    name: z.string().min(1).optional(),
    isActive: z.boolean().optional(),
    noAvailability: z.boolean().optional(),
    sort: z.enum(["CHEAPEST", "MOST_EXPENSIVE"]).optional(),
    limit: z.number().int().positive().optional(),
    priceFilter: z
      .object({
        field: priceFieldSchema,
        operator: z.enum(["gt", "gte", "lt", "lte"]),
        value: z.number().finite(),
      })
      .strict()
      .optional(),
  })
  .strict();

const priceOperationSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.enum(["PERCENT_CHANGE", "DELTA"]),
      direction: z.enum(["increase", "decrease"]),
      value: z.number().finite().positive(),
    })
    .strict(),
  z
    .object({
      type: z.enum(["MULTIPLY", "DIVIDE", "SET", "CAP_AT", "FLOOR_AT"]),
      value: z.number().finite().positive(),
    })
    .strict(),
]);

export const llmPmsIntentSchema = z
  .object({
    type: z.enum([
      "ROOM_LIST",
      "ROOM_FILTER",
      "ROOM_SORT",
      "ROOM_CREATE",
      "ROOM_UPDATE",
      "ROOM_DELETE",
      "ROOM_DEACTIVATE",
      "PRICE_CAPACITY_UPDATE",
      "CLARIFICATION_REQUIRED",
      "GUIDANCE",
    ]),
    reason: z.string().min(1),
    clarificationQuestion: z.string().min(1).optional(),
    guidanceMessage: z.string().min(1).optional(),
    hotelId: z.union([z.string(), z.number()]).optional(),
    roomId: z.number().int().positive().optional(),
    name: z.string().min(1).optional(),
    defaultCount: z.number().finite().positive().optional(),
    update: z
      .object({
        name: z.string().min(1).optional(),
        defaultCount: z.number().finite().positive().optional(),
        isActive: z.boolean().optional(),
      })
      .strict()
      .optional(),
    roomQuery: roomQueryIntentShape.optional(),
    priceFields: z.array(priceFieldSchema).optional(),
    priceOperation: priceOperationSchema.optional(),
    roundTo: z.number().finite().positive().optional(),
  })
  .strict();

export type LlmPmsIntent = z.infer<typeof llmPmsIntentSchema>;

export type PmsLlmIntentContext = {
  messages: Array<{
    role: string;
    content: string;
  }>;
  latestReadResult?: unknown;
  latestActionProposal?: unknown;
};

export async function interpretPmsActionWithLlm(
  config: ServerConfig,
  message: string,
  context: PmsLlmIntentContext,
): Promise<PmsIntentExtractionResult> {
  assertAgentLlmConfig(config);

  const llm = createAgentLlm(config).withStructuredOutput(llmPmsIntentSchema);
  const response = await llm.invoke([
    new SystemMessage(createSystemPrompt()),
    new HumanMessage(
      [
        `Current user message: ${message}`,
        "",
        `Recent chat context JSON: ${JSON.stringify(context)}`,
      ].join("\n"),
    ),
  ]);

  return convertLlmIntentToPmsIntent(response);
}

export function convertLlmIntentToPmsIntent(
  intent: LlmPmsIntent,
): PmsIntentExtractionResult {
  if (intent.type === "CLARIFICATION_REQUIRED") {
    return {
      ok: false,
      intentType: "CLARIFICATION_REQUIRED",
      clarification:
        intent.clarificationQuestion ??
        "Please clarify the hotel, target rooms, and price operation.",
    };
  }

  if (intent.type === "GUIDANCE") {
    return {
      ok: false,
      intentType: "GUIDANCE",
      clarification:
        intent.guidanceMessage ??
        "I can help with confirmed PMS room and price actions.",
    };
  }

  if (
    intent.type === "ROOM_LIST" ||
    intent.type === "ROOM_FILTER" ||
    intent.type === "ROOM_SORT"
  ) {
    const hotelId = intent.hotelId ?? intent.roomQuery?.hotelId;
    if (!hotelId) {
      return missing("ROOM_LIST", "Which hotel ID should I show rooms for?");
    }

    return {
      ok: true,
      intent: {
        type: intent.type,
        ...normalizeRoomQuery(intent.roomQuery),
        hotelId,
      },
    };
  }

  if (intent.type === "ROOM_CREATE") {
    if (!intent.hotelId) {
      return missing("ROOM_CREATE", "Which hotel ID should I add the room to?");
    }

    if (!intent.name) {
      return missing("ROOM_CREATE", "What should the new room be named?");
    }

    return {
      ok: true,
      intent: {
        type: "ROOM_CREATE",
        hotelId: intent.hotelId,
        name: intent.name,
        defaultCount: intent.defaultCount,
      },
    };
  }

  if (intent.type === "ROOM_UPDATE") {
    if (!intent.roomId) {
      return missing("ROOM_UPDATE", "Which room ID should I edit?");
    }

    if (!intent.update || Object.keys(intent.update).length === 0) {
      return missing(
        "ROOM_UPDATE",
        "Which room field should I change, and what is the new value?",
      );
    }

    return {
      ok: true,
      intent: {
        type: "ROOM_UPDATE",
        hotelId: intent.hotelId,
        roomId: intent.roomId,
        update: intent.update,
      },
    };
  }

  if (intent.type === "ROOM_DELETE") {
    if (!intent.roomId) {
      return missing("ROOM_DELETE", "Which room ID should I delete?");
    }

    return {
      ok: true,
      intent: {
        type: "ROOM_DELETE",
        hotelId: intent.hotelId,
        roomId: intent.roomId,
      },
    };
  }

  if (intent.type === "ROOM_DEACTIVATE") {
    if (intent.roomQuery?.noAvailability) {
      const hotelId = intent.hotelId ?? intent.roomQuery.hotelId;
      if (!hotelId) {
        return missing(
          "ROOM_DEACTIVATE",
          "Which hotel ID should I check for rooms with no availability?",
        );
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

    if (!intent.roomId) {
      return missing("ROOM_DEACTIVATE", "Which room ID should I deactivate?");
    }

    return {
      ok: true,
      intent: {
        type: "ROOM_DEACTIVATE",
        hotelId: intent.hotelId,
        roomId: intent.roomId,
      },
    };
  }

  if (intent.type === "PRICE_CAPACITY_UPDATE") {
    return convertPriceUpdateIntent(intent);
  }

  return {
    ok: false,
    intentType: "UNSUPPORTED",
  };
}

function convertPriceUpdateIntent(
  intent: LlmPmsIntent,
): PmsIntentExtractionResult {
  const hotelId = intent.hotelId ?? intent.roomQuery?.hotelId;
  if (!hotelId) {
    return missing(
      "PRICE_CAPACITY_UPDATE",
      "Which hotel ID should I update prices for?",
    );
  }

  if (!intent.priceOperation) {
    return missing("PRICE_CAPACITY_UPDATE", "How should I change the price?");
  }

  const fields = intent.priceFields ?? [];
  if (fields.length === 0) {
    return missing(
      "PRICE_CAPACITY_UPDATE",
      "Which price field should I update?",
    );
  }

  const selection: RoomQueryIntent = {
    type: intent.roomQuery?.sort
      ? "ROOM_SORT"
      : intent.roomQuery?.priceFilter ||
          intent.roomQuery?.name ||
          intent.roomQuery?.noAvailability
        ? "ROOM_FILTER"
        : "ROOM_LIST",
    ...normalizeRoomQuery(intent.roomQuery),
    hotelId,
  };

  return {
    ok: true,
    intent: {
      type: "PRICE_CAPACITY_UPDATE",
      hotelId,
      selection,
      fields,
      operation: intent.priceOperation,
      roundTo: intent.roundTo,
    } satisfies FixedPriceUpdateIntent,
  };
}

function normalizeRoomQuery(
  roomQuery: LlmPmsIntent["roomQuery"],
): Partial<RoomQueryIntent> {
  if (!roomQuery) {
    return {};
  }

  return {
    roomId: roomQuery.roomId,
    name: roomQuery.name,
    isActive: roomQuery.isActive,
    noAvailability: roomQuery.noAvailability,
    sort: roomQuery.sort,
    limit: roomQuery.limit,
    priceFilter: roomQuery.priceFilter,
  };
}

function missing(
  intentType: PmsIntentExtractionResult extends infer Result
    ? Result extends { ok: false; intentType: infer Type }
      ? Type
      : never
    : never,
  clarification: string,
): PmsIntentExtractionResult {
  return {
    ok: false,
    intentType,
    clarification,
  };
}

function createSystemPrompt(): string {
  return [
    "You classify hotel PMS chat messages into JSON intent only.",
    "The server will perform all PMS reads, proposal building, validation, confirmation, and execution. You must never claim a write happened.",
    "Use recent chat context to resolve corrections and follow-ups. If the previous message asked about hotel 1 and the user says 'not percentage, multiply display price by 2', reuse hotel 1 and the previous room selection.",
    "Supported actions: room list/filter/sort, room create/update/delete/deactivate, and price-capacity update proposals.",
    "Supported price operations: PERCENT_CHANGE, DELTA, MULTIPLY, DIVIDE, SET, CAP_AT, FLOOR_AT, optional roundTo.",
    "When the user gives a number, ranking, filter, percentage, or exact target, always preserve it in JSON. Examples: '2 cheapest rooms' means roomQuery.sort CHEAPEST and roomQuery.limit 2; '3 most expensive rooms' means MOST_EXPENSIVE and limit 3; 'first 5 rooms' means limit 5; 'room 4' means roomQuery.roomId 4.",
    "For explicit fields, use exactly those priceFields. 'display price' means ['displayPrice']; 'board price' means ['boardPrice']; 'payable price' means ['payablePrice']; 'all prices' means ['boardPrice','displayPrice','payablePrice'].",
    "There is no configured default price field. If the user only says 'price' or 'prices' without naming a field or saying all prices, return CLARIFICATION_REQUIRED asking which price field to update.",
    "If required information is missing or unsafe, return CLARIFICATION_REQUIRED with a concise clarificationQuestion.",
  ].join("\n");
}
