import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerConfig } from "../config";
import { normalizeBaseUrl } from "../config";
import {
  buildLamasooBearerHeaders,
  buildLamasooExchangeHeaders,
  getBundle,
  listHotels,
  listBundles,
  listRatePlans,
  listRoomTypes,
  upsertPriceCapacity,
} from "./client";

const config: ServerConfig = {
  appUrl: "http://localhost:3001",
  openRouterApiKey: "",
  openRouterBaseUrl: "https://openrouter.ai/api/v1",
  agentModel: "",
  agentTemperature: 0.2,
  agentMaxTokens: 1200,
  openRouterSiteUrl: "http://localhost:3001",
  openRouterAppTitle: "Agent",
  openRouterAppCategories: "productivity",
  ragKbsBaseUrl: "http://localhost:3000",
  ragKbsTenantId: "tenant_acme",
  ragKbsKnowledgeBaseId: "",
  ragKbsApiKey: "",
  lamasooBaseUrl: "https://whale.lamasoo.com",
  authorization: "jwt-token",
  exchangeAuthorization: "exchange-token",
};

describe("Lamasoo client", function () {
  beforeEach(function () {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("normalizes base URLs and builds exchange and Bearer hotel headers", function () {
    expect(normalizeBaseUrl("https://whale.lamasoo.com/")).toBe(
      "https://whale.lamasoo.com",
    );
    expect(buildLamasooExchangeHeaders(config, 12)).toEqual({
      "exchange-authorization": "exchange-token",
      "hotel-id": "12",
    });
    expect(
      buildLamasooBearerHeaders(
        { ...config, authorization: "Bearer jwt-token" },
        12,
      ),
    ).toEqual({
      Authorization: "Bearer jwt-token",
      "hotel-id": "12",
    });
  });

  it("calls hotel, room, rate-plan, bundle, bundle detail, and upsert endpoints", async function () {
    mockFetchJsonQueue([
      { body: [{ id: 1, name: "Aria Hotel", isActive: true }] },
      { body: [{ id: 10, name: "Deluxe Twin", defaultCount: 5 }] },
      {
        body: [{ id: 20, name: "Breakfast", mealType: "BB", currency: "IRR" }],
      },
      {
        body: [
          {
            id: 30,
            name: "Summer",
            hotelProviderId: 2898,
            hotelProvider: { hotelId: 1 },
            roomCount: 1,
          },
        ],
      },
      { body: createBundleDetails() },
      { body: { ok: true } },
    ]);

    await expect(listHotels(config)).resolves.toEqual([
      { id: 1, name: "Aria Hotel", isActive: true },
    ]);
    await expect(listRoomTypes(config, 1)).resolves.toEqual([
      { id: 10, name: "Deluxe Twin", defaultCount: 5 },
    ]);
    await expect(listRatePlans(config, 1)).resolves.toEqual([
      { id: 20, name: "Breakfast", mealType: "BB", currency: "IRR" },
    ]);
    await expect(listBundles(config, 1)).resolves.toEqual([
      {
        id: 30,
        name: "Summer",
        hotelProviderId: 2898,
        hotelProvider: { hotelId: 1 },
        roomCount: 1,
      },
    ]);
    await expect(getBundle(config, 1, 30)).resolves.toEqual(
      createBundleDetails(),
    );
    await expect(
      upsertPriceCapacity(config, {
        hotelId: 1,
        items: [
          {
            date: "2026-08-01",
            roomTypeProviderId: 10,
            price: { ratePlanId: 20, displayPrice: 7000000 },
          },
        ],
      }),
    ).resolves.toEqual({ ok: true });

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
      "https://whale.lamasoo.com/api/exchange/hotels",
      "https://whale.lamasoo.com/api/exchange/room-type-providers",
      "https://whale.lamasoo.com/api/exchange/rate-plans",
      "https://whale.lamasoo.com/api/bundle",
      "https://whale.lamasoo.com/api/bundle/30",
      "https://whale.lamasoo.com/api/exchange/price-capacity/upsert",
    ]);
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      "exchange-authorization": "exchange-token",
    });
    expect(fetchMock.mock.calls[3][1]?.headers).toMatchObject({
      Authorization: "Bearer jwt-token",
    });
    expect(fetchMock.mock.calls[3][1]?.headers).toMatchObject({
      "hotel-id": "1",
    });
    expect(fetchMock.mock.calls[4][1]?.headers).toMatchObject({
      Authorization: "Bearer jwt-token",
      "hotel-id": "1",
    });
    expect(fetchMock.mock.calls[5][1]).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({
        "exchange-authorization": "exchange-token",
        "hotel-id": "1",
      }),
      body: JSON.stringify({
        items: [
          {
            date: "2026-08-01",
            roomTypeProviderId: 10,
            price: { ratePlanId: 20, displayPrice: 7000000 },
          },
        ],
      }),
    });
  });

  it("accepts empty list responses", async function () {
    mockFetchJsonQueue([
      { body: [] },
      { body: [] },
      { body: [] },
      { body: [] },
    ]);

    await expect(listHotels(config)).resolves.toEqual([]);
    await expect(listRoomTypes(config, 1)).resolves.toEqual([]);
    await expect(listRatePlans(config, 1)).resolves.toEqual([]);
    await expect(listBundles(config, 1)).resolves.toEqual([]);
  });

  it("rejects invalid hotel response shapes", async function () {
    mockFetchJsonQueue([{ body: [{ id: 1 }] }]);

    await expect(listHotels(config)).rejects.toThrow(
      /Invalid Lamasoo hotel list response: 0\.name/,
    );
  });

  it("allows non-numeric current price fields for old-price normalization", async function () {
    mockFetchJsonQueue([
      {
        body: {
          ...createBundleDetails(),
          ratePlans: [
            {
              ratePlanId: 20,
              name: "Breakfast",
              roomRateBundles: [
                {
                  ratePlanId: 20,
                  roomTypeProviderId: 10,
                  displayPrice: "7000000",
                },
              ],
            },
          ],
        },
      },
    ]);

    await expect(getBundle(config, 1, 30)).resolves.toMatchObject({
      ratePlans: [
        {
          roomRateBundles: [
            {
              displayPrice: "7000000",
            },
          ],
        },
      ],
    });
  });

  it("rejects invalid bundle detail relationship shapes", async function () {
    mockFetchJsonQueue([
      {
        body: {
          ...createBundleDetails(),
          ratePlans: [
            {
              ratePlanId: 20,
              name: "Breakfast",
              roomRateBundles: [
                {
                  ratePlanId: 20,
                  displayPrice: 7000000,
                },
              ],
            },
          ],
        },
      },
    ]);

    await expect(getBundle(config, 1, 30)).rejects.toThrow(
      /Invalid Lamasoo bundle details response/,
    );
  });

  it("rejects bundle details that belong to another hotel", async function () {
    mockFetchJsonQueue([
      {
        body: createBundleDetails({ hotelId: 2 }),
      },
    ]);

    await expect(getBundle(config, 1, 30)).rejects.toThrow(
      /belongs to hotel 2, not 1/,
    );
  });

  it("propagates upstream API failures", async function () {
    mockFetchJsonQueue([
      {
        body: { message: "Lamasoo is unavailable" },
        status: 503,
      },
    ]);

    await expect(listHotels(config)).rejects.toThrow("Lamasoo is unavailable");
  });
});

type MockFetchResponse = {
  body: unknown;
  status?: number;
};

function mockFetchJsonQueue(responses: MockFetchResponse[]): void {
  let index = 0;

  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      const response = responses[index] ?? { body: [] };
      index += 1;

      return new Response(JSON.stringify(response.body), {
        status: response.status ?? 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
}

function createBundleDetails(input: { hotelId?: number } = {}) {
  const hotelId = input.hotelId ?? 1;

  return {
    id: 30,
    name: "Summer",
    hotelProvider: { hotelId },
    ratePlans: [
      {
        ratePlanId: 20,
        name: "Breakfast",
        currency: "IRR",
        roomRateBundles: [
          {
            id: 40,
            bundleId: 30,
            ratePlanId: 20,
            roomTypeProviderId: 10,
            boardPrice: 6000000,
            displayPrice: 7000000,
            extraGuestPrice: 0,
            roomTypeProvider: {
              id: 10,
              name: "Deluxe Twin",
              roomType: { hotelId },
            },
            priceRates: [],
            childrenPrices: [],
          },
        ],
      },
    ],
  };
}
