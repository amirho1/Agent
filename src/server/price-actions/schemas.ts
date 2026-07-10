import { z } from "zod";

export const entityIdSchema = z.union([z.string(), z.number()]);

export const priceFilterSchema = z
  .object({
    field: z.enum(["displayPrice", "boardPrice", "payablePrice"]),
    operator: z.enum(["gt", "gte", "lt", "lte"]),
    value: z.number().finite(),
  })
  .strict();

export const priceUpdateIntentSchema = z
  .object({
    type: z.literal("PRICE_PERCENTAGE_UPDATE"),
    hotelId: entityIdSchema,
    percent: z.number().finite().positive().max(100),
    direction: z.enum(["increase", "decrease"]),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    roomTypeProviderId: z.number().int().positive().optional(),
    roomName: z.string().min(1).optional(),
    ratePlanId: z.number().int().positive().optional(),
    ratePlanName: z.string().min(1).optional(),
    priceFilters: z.array(priceFilterSchema).default([]),
  })
  .strict()
  .superRefine((value, context) => {
    if (Boolean(value.from) !== Boolean(value.to)) {
      context.addIssue({
        code: "custom",
        message: "from and to must be provided together",
        path: ["from"],
      });
    }

    if (value.from && value.to && value.from > value.to) {
      context.addIssue({
        code: "custom",
        message: "from must be before or equal to to",
        path: ["from"],
      });
    }
  });

export const childrenPriceSchema = z
  .object({
    childrenCategoryId: entityIdSchema,
    amount: z.number().finite(),
    priceType: z.enum(["FREE", "FIXED", "PERCENT"]),
  })
  .strict();

export const priceConstraintSchema = z
  .object({
    cta: z.boolean().optional(),
    ctd: z.boolean().optional(),
    minLos: z.number().int().positive().optional(),
    maxLos: z.number().int().positive().optional(),
    stopSell: z.boolean().optional(),
  })
  .strict();

export const pricePayloadSchema = z
  .object({
    ratePlanId: entityIdSchema,
    boardPrice: z.number().finite().positive().optional(),
    displayPrice: z.number().finite().positive().optional(),
    payablePrice: z.number().finite().positive().optional(),
    extraGuestPrice: z.number().finite().positive().optional(),
    childrenPrices: z.array(childrenPriceSchema).optional(),
  })
  .strict();

export const priceCapacityUpsertItemSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    roomTypeProviderId: entityIdSchema,
    count: z.number().finite().positive().optional(),
    constraint: priceConstraintSchema.optional(),
    price: pricePayloadSchema,
  })
  .strict();

export const agentActionDiffSchema = z
  .object({
    action: z
      .enum(["CREATE", "UPDATE", "DELETE", "DEACTIVATE"])
      .default("UPDATE"),
    rowId: z.string().min(1),
    entityType: z.enum(["ROOM", "PRICE_CAPACITY"]).default("PRICE_CAPACITY"),
    roomTypeProviderId: z.number().int().positive().optional(),
    roomName: z.string().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    ratePlanId: z.number().int().positive().optional(),
    field: z.string().min(1),
    oldValue: z.union([z.string(), z.number(), z.boolean(), z.null()]),
    newValue: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  })
  .strict();

export const agentToolCallSummarySchema = z
  .object({
    name: z.string().min(1),
    input: z.unknown(),
    resultSummary: z.string().min(1),
  })
  .strict();

export const roomActionPmsPayloadSchema = z.union([
  z
    .object({
      action: z.literal("CREATE_ROOM"),
      hotelId: entityIdSchema,
      room: z
        .object({
          name: z.string().min(1),
          defaultCount: z.number().finite().positive(),
          isActive: z.boolean().optional(),
          description: z.string().optional(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      action: z.enum(["UPDATE_ROOM", "DEACTIVATE_ROOM"]),
      hotelId: entityIdSchema,
      roomId: entityIdSchema,
      update: z
        .object({
          name: z.string().min(1).optional(),
          defaultCount: z.number().finite().positive().optional(),
          isActive: z.boolean().optional(),
          description: z.string().optional(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      action: z.literal("DELETE_ROOM"),
      hotelId: entityIdSchema,
      roomId: entityIdSchema,
    })
    .strict(),
]);

export const priceCapacityActionPayloadSchema = z
  .object({
    items: z.array(priceCapacityUpsertItemSchema),
  })
  .strict();

export const agentActionProposalSchema = z
  .object({
    type: z.enum([
      "ROOM_CREATE",
      "ROOM_UPDATE",
      "ROOM_DELETE",
      "ROOM_DEACTIVATE",
      "PRICE_CAPACITY_UPDATE",
      "PRICE_CAPACITY_UPSERT",
    ]),
    status: z.literal("PENDING_CONFIRMATION"),
    title: z.string().min(1),
    summary: z.string().min(1),
    hotelId: entityIdSchema.optional(),
    affectedRowsCount: z.number().int().nonnegative(),
    assumptions: z.array(z.string()),
    warnings: z.array(z.string()),
    toolCalls: z.array(agentToolCallSummarySchema),
    diffs: z.array(agentActionDiffSchema),
    pmsPayload: z.union([
      priceCapacityActionPayloadSchema,
      roomActionPmsPayloadSchema,
      z
        .object({
          items: z.array(roomActionPmsPayloadSchema),
        })
        .strict(),
    ]),
  })
  .strict();

export const agentReadResultSchema = z
  .object({
    type: z.enum(["ROOM_LIST", "ROOM_FILTER", "ROOM_SORT"]),
    title: z.string().min(1),
    summary: z.string().min(1),
    hotelId: entityIdSchema.optional(),
    matchedRowsCount: z.number().int().nonnegative(),
    columns: z.array(z.string().min(1)),
    rows: z.array(z.record(z.string(), z.unknown())),
    toolCalls: z.array(agentToolCallSummarySchema),
  })
  .strict();

export const proposalStatusSchema = z.enum([
  "PENDING",
  "EXECUTED",
  "REJECTED",
  "FAILED",
]);

export type PriceUpdateIntentInput = z.infer<typeof priceUpdateIntentSchema>;
