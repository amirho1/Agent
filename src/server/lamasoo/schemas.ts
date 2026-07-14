import { z } from "zod";
import type {
  BundleDetails,
  BundleSummary,
  Hotel,
  RatePlan,
  RoomTypeProvider,
} from "@/src/shared/agent-types";

const entityIdSchema = z.union([z.string(), z.number()]);

const hotelProviderSchema = z
  .object({
    id: entityIdSchema.optional(),
    hotelId: entityIdSchema.optional(),
    providerId: entityIdSchema.optional(),
    isActive: z.boolean().optional(),
    isDeleted: z.boolean().optional(),
    hasChildrenPolicy: z.boolean().optional(),
  })
  .passthrough();

const roomTypeSchema = z
  .object({
    id: entityIdSchema.optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    capacity: z.number().optional(),
    extraCapacity: z.number().optional(),
    hotelId: entityIdSchema.optional(),
    isActive: z.boolean().optional(),
    count: z.number().optional(),
    maxChildrenWithoutBed: z.number().optional(),
  })
  .passthrough();

export const hotelSchema: z.ZodType<Hotel> = z
  .object({
    id: entityIdSchema,
    name: z.string(),
    isActive: z.boolean().optional(),
  })
  .passthrough();

export const currentHotelSchema: z.ZodType<Hotel> = z.object({
  id: entityIdSchema,
  name: z.string(),
  isActive: z.boolean().optional(),
});

export const roomTypeProviderSchema: z.ZodType<RoomTypeProvider> = z
  .object({
    id: entityIdSchema,
    hotelProviderId: entityIdSchema.optional(),
    hotelId: entityIdSchema.optional(),
    name: z.string(),
    defaultCount: z.number().optional(),
    isActive: z.boolean().optional(),
    roomType: roomTypeSchema.optional(),
  })
  .passthrough();

export const ratePlanSchema: z.ZodType<RatePlan> = z
  .object({
    id: entityIdSchema,
    hotelProviderId: entityIdSchema.optional(),
    hotelId: entityIdSchema.optional(),
    name: z.string(),
    mealType: z.string().optional(),
    currency: z.string().optional(),
    isActive: z.boolean().optional(),
  })
  .passthrough();

export const bundleSummarySchema: z.ZodType<BundleSummary> = z
  .object({
    id: entityIdSchema,
    name: z.string(),
    type: z.string().optional(),
    hotelProviderId: entityIdSchema.optional(),
    hotelProvider: hotelProviderSchema.optional(),
    roomCount: z.number().optional(),
  })
  .passthrough();

const roomRateBundleSchema = z
  .object({
    id: entityIdSchema.optional(),
    bundleId: entityIdSchema.optional(),
    ratePlanId: entityIdSchema,
    roomTypeProviderId: entityIdSchema,
    boardPrice: z.unknown().optional(),
    displayPrice: z.unknown().optional(),
    payablePrice: z.unknown().optional(),
    extraGuestPrice: z.number().optional(),
    roomTypeProvider: roomTypeProviderSchema.optional(),
    priceRates: z.array(z.unknown()).optional(),
    childrenPrices: z.array(z.unknown()).optional(),
  })
  .passthrough();

const bundleRatePlanSchema = z
  .object({
    ratePlanId: entityIdSchema,
    name: z.string(),
    mealType: z.string().optional(),
    currency: z.string().optional(),
    extraGuestPrice: z.number().optional(),
    roomRateBundles: z.array(roomRateBundleSchema),
  })
  .passthrough();

export const bundleDetailsSchema: z.ZodType<BundleDetails> =
  bundleSummarySchema.and(
    z
      .object({
        ratePlans: z.array(bundleRatePlanSchema),
      })
      .passthrough(),
  );

export const hotelListSchema = z.array(hotelSchema);
export const roomTypeProviderListSchema = z.array(roomTypeProviderSchema);
export const ratePlanListSchema = z.array(ratePlanSchema);
export const bundleSummaryListSchema = z.array(bundleSummarySchema);

/**
 * Validate a Lamasoo response body against the expected schema.
 * @param schema - Zod schema for the expected response body.
 * @param response - Raw response body.
 * @param responseName - Human-readable response name for errors.
 * @returns The validated response body.
 */
export function parseLamasooResponse<T>(
  schema: z.ZodType<T>,
  response: unknown,
  responseName: string,
): T {
  const result = schema.safeParse(response);

  if (!result.success) {
    throw new Error(
      `Invalid Lamasoo ${responseName} response: ${formatZodIssues(result.error)}`,
    );
  }

  return result.data;
}

/**
 * Convert Zod issues into a concise error message.
 * @param error - Zod validation error.
 * @returns Formatted issue summary.
 */
function formatZodIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "response";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}
