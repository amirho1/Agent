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
  return fetchJson<Hotel[]>(`${config.lamasooBaseUrl}/api/exchange/hotels`, {
    targetService: "lamasoo",
    headers: buildLamasooExchangeHeaders(config),
  });
}

export async function listRoomTypes(
  config: ServerConfig,
  hotelId: EntityId,
): Promise<RoomTypeProvider[]> {
  return fetchJson<RoomTypeProvider[]>(
    `${config.lamasooBaseUrl}/api/exchange/room-type-providers`,
    {
      targetService: "lamasoo",
      headers: buildLamasooExchangeHeaders(config, hotelId),
    },
  );
}

export async function listRatePlans(
  config: ServerConfig,
  hotelId: EntityId,
): Promise<RatePlan[]> {
  return fetchJson<RatePlan[]>(
    `${config.lamasooBaseUrl}/api/exchange/rate-plans`,
    {
      targetService: "lamasoo",
      headers: buildLamasooExchangeHeaders(config, hotelId),
    },
  );
}

export async function listBundles(
  config: ServerConfig,
  hotelId: EntityId,
): Promise<BundleSummary[]> {
  return fetchJson<BundleSummary[]>(`${config.lamasooBaseUrl}/api/bundle`, {
    targetService: "lamasoo",
    headers: buildLamasooBearerHeaders(config, hotelId),
  });
}

export async function getBundle(
  config: ServerConfig,
  hotelId: EntityId,
  bundleId: EntityId,
): Promise<BundleDetails> {
  return fetchJson<BundleDetails>(
    `${config.lamasooBaseUrl}/api/bundle/${bundleId}`,
    {
      targetService: "lamasoo",
      headers: buildLamasooBearerHeaders(config, hotelId),
    },
  );
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
