import type {
  BundleDetails,
  BundleSummary,
  EntityId,
  Hotel,
  LamasooPriceCapacityPayload,
  RatePlan,
  RoomTypeProvider,
} from "@/src/shared/agent-types";
import type { ServerConfig } from "../config";
import { assertLamasooConfig, assertLamasooExchangeConfig } from "../config";
import { fetchJson } from "../http";
import {
  bundleDetailsSchema,
  bundleSummaryListSchema,
  currentHotelSchema,
  hotelListSchema,
  parseLamasooResponse,
  ratePlanListSchema,
  roomTypeProviderListSchema,
} from "./schemas";

export function buildLamasooExchangeHeaders(
  config: ServerConfig,
  hotelId?: EntityId,
): HeadersInit {
  assertLamasooExchangeConfig(config);

  return {
    "exchange-authorization": normalizeToken(config.exchangeAuthorization),
    ...(hotelId !== undefined ? { "hotel-id": String(hotelId) } : {}),
  };
}

export function buildLamasooBearerHeaders(
  config: ServerConfig,
  hotelId?: EntityId,
): HeadersInit {
  assertLamasooConfig(config);

  return {
    Authorization: `Bearer ${normalizeToken(config.authorization)}`,
    ...(hotelId !== undefined ? { "hotel-id": String(hotelId) } : {}),
  };
}

export async function listHotels(config: ServerConfig): Promise<Hotel[]> {
  const response = await fetchJson<unknown>(
    `${config.lamasooBaseUrl}/api/exchange/hotels`,
    {
      targetService: "lamasoo",
      headers: buildLamasooExchangeHeaders(config),
    },
  );

  return parseLamasooResponse(hotelListSchema, response, "hotel list");
}

export async function getCurrentHotel(config: ServerConfig): Promise<Hotel> {
  const response = await fetchJson<unknown>(
    `${config.lamasooBaseUrl}/api/hotel/my/data`,
    {
      targetService: "lamasoo",
      headers: buildLamasooBearerHeaders(config),
    },
  );

  return parseLamasooResponse(currentHotelSchema, response, "current hotel");
}

export async function listRoomTypes(
  config: ServerConfig,
  hotelId: EntityId,
): Promise<RoomTypeProvider[]> {
  const response = await fetchJson<unknown>(
    `${config.lamasooBaseUrl}/api/exchange/room-type-providers`,
    {
      targetService: "lamasoo",
      headers: buildLamasooExchangeHeaders(config, hotelId),
    },
  );

  return parseLamasooResponse(
    roomTypeProviderListSchema,
    response,
    "room type provider list",
  );
}

export async function listRatePlans(
  config: ServerConfig,
  hotelId: EntityId,
): Promise<RatePlan[]> {
  const response = await fetchJson<unknown>(
    `${config.lamasooBaseUrl}/api/exchange/rate-plans`,
    {
      targetService: "lamasoo",
      headers: buildLamasooExchangeHeaders(config, hotelId),
    },
  );

  return parseLamasooResponse(ratePlanListSchema, response, "rate plan list");
}

export async function listBundles(
  config: ServerConfig,
  hotelId: EntityId,
): Promise<BundleSummary[]> {
  const response = await fetchJson<unknown>(
    `${config.lamasooBaseUrl}/api/bundle`,
    {
      targetService: "lamasoo",
      headers: buildLamasooBearerHeaders(config, hotelId),
    },
  );

  return parseLamasooResponse(bundleSummaryListSchema, response, "bundle list");
}

export async function getBundle(
  config: ServerConfig,
  hotelId: EntityId,
  bundleId: EntityId,
): Promise<BundleDetails> {
  const response = await fetchJson<unknown>(
    `${config.lamasooBaseUrl}/api/bundle/${bundleId}`,
    {
      targetService: "lamasoo",
      headers: buildLamasooBearerHeaders(config, hotelId),
    },
  );

  const bundle = parseLamasooResponse(
    bundleDetailsSchema,
    response,
    "bundle details",
  );
  assertBundleDetailsBelongToHotel(bundle, hotelId);

  return bundle;
}

/**
 * Ensure nested bundle detail room records match the requested hotel when the API provides hotel IDs.
 * @param bundle - Bundle details returned by Lamasoo.
 * @param hotelId - Requested hotel ID.
 */
function assertBundleDetailsBelongToHotel(
  bundle: BundleDetails,
  hotelId: EntityId,
): void {
  if (
    bundle.hotelProvider?.hotelId !== undefined &&
    !isSameEntityId(bundle.hotelProvider.hotelId, hotelId)
  ) {
    throw new Error(
      `Invalid Lamasoo bundle details response: bundle ${String(bundle.id)} belongs to hotel ${String(bundle.hotelProvider.hotelId)}, not ${String(hotelId)}.`,
    );
  }

  for (const ratePlan of bundle.ratePlans) {
    for (const roomRateBundle of ratePlan.roomRateBundles) {
      const roomHotelId = roomRateBundle.roomTypeProvider?.roomType?.hotelId;

      if (roomHotelId !== undefined && !isSameEntityId(roomHotelId, hotelId)) {
        throw new Error(
          `Invalid Lamasoo bundle details response: room ${String(roomRateBundle.roomTypeProviderId)} belongs to hotel ${String(roomHotelId)}, not ${String(hotelId)}.`,
        );
      }
    }
  }
}

/**
 * Compare entity IDs without assuming Lamasoo always returns the same primitive type.
 * @param left - First entity ID.
 * @param right - Second entity ID.
 * @returns True when both IDs represent the same value.
 */
function isSameEntityId(left: EntityId, right: EntityId): boolean {
  return String(left) === String(right);
}

export async function upsertPriceCapacity(
  config: ServerConfig,
  payload: LamasooPriceCapacityPayload,
): Promise<unknown> {
  return fetchJson<unknown>(
    `${config.lamasooBaseUrl}/api/exchange/price-capacity/upsert`,
    {
      targetService: "lamasoo",
      method: "POST",
      headers: buildLamasooExchangeHeaders(config, payload.hotelId),
      body: {
        items: payload.items,
      },
    },
  );
}

function normalizeToken(token: string): string {
  return token.replace(/^Bearer\s+/i, "").trim();
}
