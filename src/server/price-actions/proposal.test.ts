import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerConfig } from "../config";
import { preparePercentagePriceProposal } from "./proposal";

vi.mock("../dummy-pms/client", () => ({
  listRoomTypes: vi.fn(async () => [
    { id: 31, hotelId: 1, name: "Deluxe Twin" },
  ]),
  listRatePlans: vi.fn(async () => [
    { id: 112, hotelId: 1, name: "HB USD Plan" },
  ]),
  listChildrenCategories: vi.fn(async () => [
    { id: 141, hotelId: 1, name: "Infant" },
  ]),
  getPriceCapacityRows: vi.fn(async () => [
    {
      id: 411,
      hotelId: 1,
      date: "2026-08-01",
      roomTypeProviderId: 31,
      count: 2,
      constraint: { minLos: 1, maxLos: 10, stopSell: false },
      price: {
        ratePlanId: 112,
        boardPrice: 600,
        displayPrice: 700,
        payablePrice: 550,
        extraGuestPrice: 40,
        childrenPrices: [
          { childrenCategoryId: 141, amount: 0, priceType: "FREE" },
        ],
      },
    },
  ]),
}));

const config: ServerConfig = {
  appUrl: "http://localhost:3001",
  openRouterApiKey: "test",
  openRouterBaseUrl: "https://openrouter.ai/api/v1",
  agentModel: "test/model",
  agentTemperature: 0.2,
  agentMaxTokens: 1200,
  openRouterSiteUrl: "http://localhost:3001",
  openRouterAppTitle: "Agent",
  openRouterAppCategories: "productivity",
  ragKbsBaseUrl: "http://localhost:3000",
  ragKbsTenantId: "tenant_acme",
  ragKbsKnowledgeBaseId: "",
  ragKbsApiKey: "",
  dummyPmsBaseUrl: "http://localhost:4000",
  dummyPmsAuthToken: "test-token",
};

describe("preparePercentagePriceProposal", function () {
  beforeEach(function () {
    vi.clearAllMocks();
  });

  it("creates a validated proposal and preserves non-target price fields", async function () {
    const prepared = await preparePercentagePriceProposal(config, {
      type: "PRICE_PERCENTAGE_UPDATE",
      hotelId: 1,
      percent: 10,
      direction: "increase",
      priceFilters: [],
    });

    expect(prepared.proposal.affectedRowsCount).toBe(1);
    expect(prepared.proposal.diffs).toMatchObject([
      { field: "boardPrice", oldValue: 600, newValue: 660 },
      { field: "displayPrice", oldValue: 700, newValue: 770 },
    ]);
    if (!("items" in prepared.proposal.pmsPayload)) {
      throw new Error("Expected price-capacity payload items.");
    }
    expect(prepared.proposal.pmsPayload.items[0]).toMatchObject({
      count: 2,
      constraint: { minLos: 1, maxLos: 10, stopSell: false },
      price: {
        ratePlanId: 112,
        boardPrice: 660,
        displayPrice: 770,
        payablePrice: 550,
        extraGuestPrice: 40,
        childrenPrices: [
          { childrenCategoryId: 141, amount: 0, priceType: "FREE" },
        ],
      },
    });
    expect(prepared.proposal.assumptions.join(" ")).toMatch(/No date range/);
    expect(prepared.oldValues).toEqual([
      {
        entityType: "PRICE_CAPACITY",
        rowId: "2026-08-01:31:112",
        date: "2026-08-01",
        roomTypeProviderId: 31,
        ratePlanId: 112,
        boardPrice: 600,
        displayPrice: 700,
      },
    ]);
  });
});
