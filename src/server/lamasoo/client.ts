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
import { assertLamasooConfig } from "../config";
import { fetchJson } from "../http";

export function buildLamasooHeaders(
  config: ServerConfig,
  hotelId?: EntityId,
): HeadersInit {
  assertLamasooConfig(config);

  return {
    Authorization: `Bearer ${config.authorization}`,
    ...(hotelId !== undefined ? { "hotel-id": String(hotelId) } : {}),
  };
}

export async function listHotels(config: ServerConfig): Promise<Hotel[]> {
  return fetchJson<Hotel[]>(`${config.lamasooBaseUrl}/api/exchange/hotels`, {
    headers: buildLamasooHeaders(config),
  });
}

export async function listRoomTypes(
  config: ServerConfig,
  hotelId: EntityId,
): Promise<RoomTypeProvider[]> {
  return fetchJson<RoomTypeProvider[]>(
    `${config.lamasooBaseUrl}/api/exchange/room-type-providers`,
    {
      headers: buildLamasooHeaders(config, hotelId),
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
      headers: buildLamasooHeaders(config, hotelId),
    },
  );
}

export async function listBundles(
  config: ServerConfig,
  hotelId: EntityId,
): Promise<BundleSummary[]> {
  return fetchJson<BundleSummary[]>(`${config.lamasooBaseUrl}/api/bundle`, {
    headers: buildLamasooHeaders(config, hotelId),
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
      headers: buildLamasooHeaders(config, hotelId),
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
      method: "POST",
      headers: buildLamasooHeaders(config, payload.hotelId),
      body: {
        items: payload.items,
      },
    },
  );
}
