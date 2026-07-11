import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerConfig } from "../config";
import { normalizeBaseUrl } from "../config";
import {
  buildLamasooBearerHeaders,
  buildLamasooExchangeHeaders,
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
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify([]), { status: 200 })),
    );
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

  it("calls hotel, room, rate-plan, and upsert endpoints", async function () {
    await listHotels(config);
    await listRoomTypes(config, 1);
    await listRatePlans(config, 1);
    await listBundles(config, 1);
    await upsertPriceCapacity(config, {
      hotelId: 1,
      items: [
        {
          date: "2026-08-01",
          roomTypeProviderId: 10,
          price: { ratePlanId: 20, displayPrice: 7000000 },
        },
      ],
    });

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
      "https://whale.lamasoo.com/api/exchange/hotels",
      "https://whale.lamasoo.com/api/exchange/room-type-providers",
      "https://whale.lamasoo.com/api/exchange/rate-plans",
      "https://whale.lamasoo.com/api/bundle",
      "https://whale.lamasoo.com/api/exchange/price-capacity/upsert",
    ]);
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      "exchange-authorization": "exchange-token",
    });
    expect(fetchMock.mock.calls[3][1]?.headers).toMatchObject({
      Authorization: "Bearer jwt-token",
    });
    expect(fetchMock.mock.calls[4][1]).toMatchObject({
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
});
