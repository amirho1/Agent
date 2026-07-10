import type {
  ChildrenCategory,
  EntityId,
  ExecutionResult,
  Hotel,
  PreparedPriceCapacityPayload,
  PriceCapacityRecord,
  RatePlan,
  RoomTypeProvider,
} from "../../shared/agent-types";
import type { ServerConfig } from "../config";
import { fetchJson } from "../http";

export type PriceCapacityRowFilters = {
  hotelId: EntityId;
  from?: string;
  to?: string;
  roomTypeProviderId?: EntityId;
  ratePlanId?: EntityId;
  displayPriceGt?: number;
  displayPriceGte?: number;
  displayPriceLt?: number;
  displayPriceLte?: number;
  boardPriceGt?: number;
  boardPriceGte?: number;
  boardPriceLt?: number;
  boardPriceLte?: number;
  payablePriceGt?: number;
  payablePriceGte?: number;
  payablePriceLt?: number;
  payablePriceLte?: number;
};

export type RoomSearchFilters = {
  hotelId: EntityId;
  name?: string;
  isActive?: boolean;
};

export type CreateRoomPayload = {
  name: string;
  defaultCount: number;
  isActive?: boolean;
  description?: string;
};

export type UpdateRoomPayload = Partial<{
  name: string;
  defaultCount: number;
  isActive: boolean;
  description: string;
}>;

/**
 * List active hotels from dummy-PMS.
 * @param config - Server config.
 * @returns Hotels.
 */
export async function listHotels(config: ServerConfig): Promise<Hotel[]> {
  return fetchJson<Hotel[]>(`${config.dummyPmsBaseUrl}/api/exchange/hotels`, {
    headers: buildDummyPmsHeaders(config),
  });
}

export const getHotels = listHotels;

/**
 * List room type providers for a hotel.
 * @param config - Server config.
 * @param hotelId - Hotel ID.
 * @returns Room type providers.
 */
export async function listRoomTypes(
  config: ServerConfig,
  hotelId: EntityId,
): Promise<RoomTypeProvider[]> {
  return fetchJson<RoomTypeProvider[]>(
    `${config.dummyPmsBaseUrl}/api/exchange/room-type-providers`,
    {
      headers: buildDummyPmsHeaders(config, hotelId),
    },
  );
}

export async function getHotelRooms(
  config: ServerConfig,
  hotelId: EntityId,
): Promise<RoomTypeProvider[]> {
  return fetchJson<RoomTypeProvider[]>(
    `${config.dummyPmsBaseUrl}/hotels/${hotelId}/rooms`,
    {
      headers: buildDummyPmsHeaders(config, hotelId),
    },
  );
}

export async function getRoomById(
  config: ServerConfig,
  hotelId: EntityId,
  roomId: EntityId,
): Promise<RoomTypeProvider> {
  return fetchJson<RoomTypeProvider>(
    `${config.dummyPmsBaseUrl}/hotels/${hotelId}/rooms/${roomId}`,
    {
      headers: buildDummyPmsHeaders(config, hotelId),
    },
  );
}

export async function searchRooms(
  config: ServerConfig,
  filters: RoomSearchFilters,
): Promise<RoomTypeProvider[]> {
  const params = new URLSearchParams();
  appendOptionalParam(params, "name", filters.name);
  if (filters.isActive !== undefined) {
    params.set("isActive", String(filters.isActive));
  }

  const query = params.toString();
  return fetchJson<RoomTypeProvider[]>(
    `${config.dummyPmsBaseUrl}/hotels/${filters.hotelId}/rooms${
      query ? `?${query}` : ""
    }`,
    {
      headers: buildDummyPmsHeaders(config, filters.hotelId),
    },
  );
}

/**
 * List rate plans for a hotel.
 * @param config - Server config.
 * @param hotelId - Hotel ID.
 * @returns Rate plans.
 */
export async function listRatePlans(
  config: ServerConfig,
  hotelId: EntityId,
): Promise<RatePlan[]> {
  return fetchJson<RatePlan[]>(
    `${config.dummyPmsBaseUrl}/api/exchange/rate-plans`,
    {
      headers: buildDummyPmsHeaders(config, hotelId),
    },
  );
}

export const getRatePlans = listRatePlans;

/**
 * List children categories for a hotel.
 * @param config - Server config.
 * @param hotelId - Hotel ID.
 * @returns Children categories.
 */
export async function listChildrenCategories(
  config: ServerConfig,
  hotelId: EntityId,
): Promise<ChildrenCategory[]> {
  return fetchJson<ChildrenCategory[]>(
    `${config.dummyPmsBaseUrl}/api/exchange/children-categories`,
    {
      headers: buildDummyPmsHeaders(config, hotelId),
    },
  );
}

/**
 * Get existing price-capacity records for a hotel and date range.
 * @param config - Server config.
 * @param hotelId - Hotel ID.
 * @param from - Start date.
 * @param to - End date.
 * @returns Existing records.
 */
export async function getExistingPriceCapacity(
  config: ServerConfig,
  hotelId: EntityId,
  from: string,
  to: string,
): Promise<PriceCapacityRecord[]> {
  return getPriceCapacityRows(config, { hotelId, from, to });
}

/**
 * Get price-capacity records with optional filters.
 * @param config - Server config.
 * @param filters - PMS read filters.
 * @returns Existing records.
 */
export async function getPriceCapacityRows(
  config: ServerConfig,
  filters: PriceCapacityRowFilters,
): Promise<PriceCapacityRecord[]> {
  const params = new URLSearchParams({
    hotelId: String(filters.hotelId),
  });

  appendOptionalParam(params, "from", filters.from);
  appendOptionalParam(params, "to", filters.to);
  appendOptionalParam(params, "roomTypeProviderId", filters.roomTypeProviderId);
  appendOptionalParam(params, "ratePlanId", filters.ratePlanId);
  appendOptionalParam(params, "displayPriceGt", filters.displayPriceGt);
  appendOptionalParam(params, "displayPriceGte", filters.displayPriceGte);
  appendOptionalParam(params, "displayPriceLt", filters.displayPriceLt);
  appendOptionalParam(params, "displayPriceLte", filters.displayPriceLte);
  appendOptionalParam(params, "boardPriceGt", filters.boardPriceGt);
  appendOptionalParam(params, "boardPriceGte", filters.boardPriceGte);
  appendOptionalParam(params, "boardPriceLt", filters.boardPriceLt);
  appendOptionalParam(params, "boardPriceLte", filters.boardPriceLte);
  appendOptionalParam(params, "payablePriceGt", filters.payablePriceGt);
  appendOptionalParam(params, "payablePriceGte", filters.payablePriceGte);
  appendOptionalParam(params, "payablePriceLt", filters.payablePriceLt);
  appendOptionalParam(params, "payablePriceLte", filters.payablePriceLte);

  return fetchJson<PriceCapacityRecord[]>(
    `${config.dummyPmsBaseUrl}/api/exchange/price-capacity?${params.toString()}`,
    {
      headers: buildDummyPmsHeaders(config, filters.hotelId),
    },
  );
}

/**
 * Upsert approved price-capacity records through dummy-PMS.
 * @param config - Server config.
 * @param payload - Prepared payload.
 * @returns Execution result.
 */
export async function upsertPriceCapacity(
  config: ServerConfig,
  payload: PreparedPriceCapacityPayload,
): Promise<ExecutionResult> {
  return fetchJson<ExecutionResult>(
    `${config.dummyPmsBaseUrl}/api/exchange/price-capacity/upsert`,
    {
      method: "POST",
      headers: {
        ...buildDummyPmsHeaders(config, payload.hotelId),
        "x-actor-type": "AI_AGENT",
        "x-actor-id": "3",
      },
      body: {
        items: payload.items,
      },
    },
  );
}

export const executePriceCapacityUpsert = upsertPriceCapacity;

export async function executeCreateRoom(
  config: ServerConfig,
  hotelId: EntityId,
  payload: CreateRoomPayload,
): Promise<RoomTypeProvider> {
  return fetchJson<RoomTypeProvider>(
    `${config.dummyPmsBaseUrl}/hotels/${hotelId}/rooms`,
    {
      method: "POST",
      headers: {
        ...buildDummyPmsHeaders(config, hotelId),
        "x-actor-type": "AI_AGENT",
        "x-actor-id": "3",
      },
      body: payload,
    },
  );
}

export async function executeUpdateRoom(
  config: ServerConfig,
  hotelId: EntityId,
  roomId: EntityId,
  payload: UpdateRoomPayload,
): Promise<RoomTypeProvider> {
  return fetchJson<RoomTypeProvider>(
    `${config.dummyPmsBaseUrl}/hotels/${hotelId}/rooms/${roomId}`,
    {
      method: "PATCH",
      headers: {
        ...buildDummyPmsHeaders(config, hotelId),
        "x-actor-type": "AI_AGENT",
        "x-actor-id": "3",
      },
      body: payload,
    },
  );
}

export async function executeDeactivateRoom(
  config: ServerConfig,
  hotelId: EntityId,
  roomId: EntityId,
): Promise<RoomTypeProvider> {
  return executeUpdateRoom(config, hotelId, roomId, { isActive: false });
}

export async function executeDeleteRoom(
  config: ServerConfig,
  hotelId: EntityId,
  roomId: EntityId,
): Promise<{
  success: boolean;
  deletedRoom: RoomTypeProvider;
  deletedPriceCapacityRows: number;
}> {
  return fetchJson<{
    success: boolean;
    deletedRoom: RoomTypeProvider;
    deletedPriceCapacityRows: number;
  }>(`${config.dummyPmsBaseUrl}/hotels/${hotelId}/rooms/${roomId}`, {
    method: "DELETE",
    headers: {
      ...buildDummyPmsHeaders(config, hotelId),
      "x-actor-type": "AI_AGENT",
      "x-actor-id": "3",
    },
  });
}

/**
 * Build authenticated dummy-PMS headers.
 * @param config - Server config.
 * @param hotelId - Optional hotel ID.
 * @returns Request headers.
 */
function buildDummyPmsHeaders(
  config: ServerConfig,
  hotelId?: EntityId,
): HeadersInit {
  return {
    authorization: `Bearer ${config.dummyPmsAuthToken}`,
    ...(hotelId ? { "hotel-id": String(hotelId) } : {}),
  };
}

function appendOptionalParam(
  params: URLSearchParams,
  key: string,
  value: EntityId | number | string | undefined,
): void {
  if (value !== undefined && value !== "") {
    params.set(key, String(value));
  }
}
