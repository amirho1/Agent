import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerConfig } from "../config";
import { matchRatePlan, prepareLamasooRateUpdateProposal } from "./rate-update";
import {
  getBundle,
  listBundles,
  listHotels,
  listRatePlans,
  listRoomTypes,
} from "./client";

vi.mock("./client", () => ({
  getBundle: vi.fn(),
  listBundles: vi.fn(),
  listHotels: vi.fn(),
  listRatePlans: vi.fn(),
  listRoomTypes: vi.fn(),
}));

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

describe("Lamasoo rate update proposal", function () {
  beforeEach(function () {
    vi.clearAllMocks();
    vi.mocked(listHotels).mockResolvedValue([{ id: 1, name: "Aria Hotel" }]);
    vi.mocked(listRoomTypes).mockResolvedValue([
      { id: 10, name: "Deluxe Twin" },
    ]);
    vi.mocked(listRatePlans).mockResolvedValue([
      { id: 20, name: "Breakfast", mealType: "BB", currency: "IRR" },
      { id: 21, name: "Room Only", mealType: "RO", currency: "IRR" },
    ]);
    vi.mocked(listBundles).mockResolvedValue([
      { id: 30, name: "Summer", hotelProvider: { hotelId: 1 } },
    ]);
    vi.mocked(getBundle).mockResolvedValue({
      id: 30,
      name: "Summer",
      hotelProvider: { hotelId: 1 },
      ratePlans: [
        {
          ratePlanId: 20,
          name: "Breakfast",
          roomRateBundles: [
            {
              ratePlanId: 20,
              roomTypeProviderId: 10,
              boardPrice: 6000000,
              displayPrice: 7000000,
              roomTypeProvider: {
                id: 10,
                name: "Deluxe Twin",
                roomType: { hotelId: 1 },
              },
            },
          ],
        },
      ],
    });
  });

  it("matches RO/BB meal types and prepares only changed core price fields", async function () {
    const prepared = await prepareLamasooRateUpdateProposal(
      config,
      `
| hotel | title | from | to | currency |
|---|---|---|---|---|
| Aria Hotel | Summer | 2026-08-01 | 2026-08-02 | IRR |

| roomName | ratePlanName | boardPrice | displayPrice | payablePrice |
|---|---|---:|---:|---:|
| Deluxe Twin | BB | 6500000 | 7000000 | 5500000 |
`,
    );

    expect(matchRatePlan("RO", await listRatePlans(config, 1))).toMatchObject({
      matchedId: 21,
      status: "matched",
    });
    expect(prepared.proposal.affectedRowsCount).toBe(2);
    expect(prepared.proposal.diffs).toHaveLength(6);
    expect(prepared.proposal.lamasooPayload.items[0]).toEqual({
      date: "2026-08-01",
      roomTypeProviderId: 10,
      price: {
        ratePlanId: 20,
        boardPrice: 6500000,
        payablePrice: 5500000,
      },
    });
    expect(prepared.proposal.lamasooPayload.items[0].price).not.toHaveProperty(
      "displayPrice",
    );
  });

  it("selects only bundles related to the matched hotel", async function () {
    vi.mocked(listBundles).mockResolvedValue([
      { id: 31, name: "Summer", hotelProvider: { hotelId: 2 } },
      { id: 30, name: "Summer", hotelProvider: { hotelId: 1 } },
    ]);

    const prepared = await prepareLamasooRateUpdateProposal(
      config,
      `
hotel: Aria Hotel
title: Summer
from: 2026-08-01
to: 2026-08-01
room=Deluxe Twin, ratePlan=BB, displayPrice=7500000
`,
    );

    expect(prepared.proposal.bundleId).toBe(30);
    expect(getBundle).toHaveBeenCalledWith(config, 1, 30);
    expect(prepared.proposal.affectedRowsCount).toBe(1);
  });

  it("treats missing, falsy, and non-number old prices as zero", async function () {
    vi.mocked(getBundle).mockResolvedValue({
      id: 30,
      name: "Summer",
      hotelProvider: { hotelId: 1 },
      ratePlans: [
        {
          ratePlanId: 20,
          name: "Breakfast",
          roomRateBundles: [
            {
              ratePlanId: 20,
              roomTypeProviderId: 10,
              displayPrice: 0,
              payablePrice: "not-a-number",
            },
          ],
        },
      ],
    });

    const prepared = await prepareLamasooRateUpdateProposal(
      config,
      `
hotel: Aria Hotel
title: Summer
from: 2026-08-01
to: 2026-08-01
room=Deluxe Twin, ratePlan=BB, boardPrice=0, displayPrice=0, payablePrice=10
`,
    );

    expect(prepared.proposal.diffs).toEqual([
      expect.objectContaining({
        field: "boardPrice",
        oldValue: 0,
        newValue: 0,
        status: "unchanged",
      }),
      expect.objectContaining({
        field: "displayPrice",
        oldValue: 0,
        newValue: 0,
        status: "unchanged",
      }),
      expect.objectContaining({
        field: "payablePrice",
        oldValue: 0,
        newValue: 10,
        status: "changed",
      }),
    ]);
    expect(prepared.proposal.lamasooPayload.items).toEqual([
      {
        date: "2026-08-01",
        roomTypeProviderId: 10,
        price: { ratePlanId: 20, payablePrice: 10 },
      },
    ]);
    expect(prepared.proposal.warnings).not.toContain(
      "boardPrice old value is unavailable for one or more matched bundle rows.",
    );
  });

  it("blocks generic price, unmatched rooms, and missing prices", async function () {
    const prepared = await prepareLamasooRateUpdateProposal(
      config,
      `
hotel: Aria Hotel
title: Summer
from: 2026-08-01
to: 2026-08-01
room=Unknown Suite, ratePlan=BB, price=7000000
room=Deluxe Twin, ratePlan=BB
`,
    );

    expect(prepared.proposal.affectedRowsCount).toBe(0);
    expect(prepared.proposal.summary).toMatch(/must be resolved/);
    expect(prepared.proposal.warnings).toContain(
      "No executable Lamasoo update items were prepared.",
    );
    expect(
      prepared.proposal.diffs.some((diff) => diff.status === "error"),
    ).toBe(true);
  });

  it("reports a clear hotel issue without cascading room and rate-plan errors", async function () {
    vi.mocked(listHotels).mockResolvedValue([
      { id: 2900, name: "هتل دمو arwerk" },
    ]);

    const prepared = await prepareLamasooRateUpdateProposal(
      config,
      `
hotel: هتل الماسو تستی آریا
title: عادی
from: 2026-07-12
to: 2026-07-12
room=اتاق یک‌تخته اقتصادی, ratePlan=RO, displayPrice=18000000
`,
    );

    expect(prepared.proposal.affectedRowsCount).toBe(0);
    expect(prepared.proposal.summary).toBe(
      "1 issue must be resolved before any Lamasoo update can run.",
    );
    expect(prepared.proposal.validationIssues).toEqual([
      {
        level: "error",
        field: "hotelName",
        message:
          'Hotel "هتل الماسو تستی آریا" could not be matched confidently.',
      },
    ]);
    expect(prepared.proposal.diffs).toEqual([]);
    expect(listRoomTypes).not.toHaveBeenCalled();
    expect(listRatePlans).not.toHaveBeenCalled();
    expect(listBundles).not.toHaveBeenCalled();
    expect(prepared.proposal.title).toMatch(/Clarification/);
  });

  it("matches live-aligned Persian hotel, bundle, room, and RO rate plan names", async function () {
    vi.mocked(listHotels).mockResolvedValue([
      { id: 2900, name: "هتل دمو arwerk" },
    ]);
    vi.mocked(listRoomTypes).mockResolvedValue([
      { id: 13858, name: "اتاق یک‌تخته اقتصادی" },
    ]);
    vi.mocked(listRatePlans).mockResolvedValue([
      {
        id: 4053,
        name: "اقامت بدون وعده غذایی",
        mealType: "RO",
        currency: "IRR",
      },
    ]);
    vi.mocked(listBundles).mockResolvedValue([
      { id: 45173, name: "عادی", hotelProvider: { hotelId: 2900 } },
    ]);
    vi.mocked(getBundle).mockResolvedValue({
      id: 45173,
      name: "عادی",
      hotelProvider: { hotelId: 2900 },
      ratePlans: [
        {
          ratePlanId: 4053,
          name: "اقامت بدون وعده غذایی",
          roomRateBundles: [
            {
              ratePlanId: 4053,
              roomTypeProviderId: 13858,
              boardPrice: 4,
              displayPrice: 3,
              roomTypeProvider: {
                id: 13858,
                name: "اتاق یک‌تخته اقتصادی",
                roomType: { hotelId: 2900 },
              },
            },
          ],
        },
      ],
    });

    const prepared = await prepareLamasooRateUpdateProposal(
      config,
      `
hotel: هتل دمو arwerk
title: عادی
from: 2026-07-12
to: 2026-07-12
room=اتاق یک‌تخته اقتصادی, ratePlan=RO, boardPrice=16000000, displayPrice=18000000, payablePrice=15500000
`,
    );

    expect(prepared.proposal.validationIssues).toEqual([]);
    expect(prepared.proposal.affectedRowsCount).toBe(1);
    expect(prepared.proposal.hotelId).toBe(2900);
    expect(prepared.proposal.bundleId).toBe(45173);
    expect(prepared.proposal.lamasooPayload.items).toEqual([
      {
        date: "2026-07-12",
        roomTypeProviderId: 13858,
        price: {
          ratePlanId: 4053,
          boardPrice: 16000000,
          displayPrice: 18000000,
          payablePrice: 15500000,
        },
      },
    ]);
  });

  it("blocks unmatched bundles while still matching rooms and rate plans", async function () {
    vi.mocked(listBundles).mockResolvedValue([
      { id: 31, name: "Winter", hotelProvider: { hotelId: 1 } },
    ]);

    const prepared = await prepareLamasooRateUpdateProposal(
      config,
      `
hotel: Aria Hotel
title: Summer
from: 2026-08-01
to: 2026-08-01
room=Deluxe Twin, ratePlan=BB, displayPrice=7500000
`,
    );

    expect(getBundle).not.toHaveBeenCalled();
    expect(prepared.proposal.affectedRowsCount).toBe(0);
    expect(prepared.proposal.validationIssues).toEqual([
      {
        level: "error",
        field: "title",
        message: 'Bundle "Summer" could not be matched confidently.',
      },
    ]);
    expect(prepared.proposal.diffs).toEqual([
      expect.objectContaining({
        status: "error",
        roomTypeProviderId: 10,
        roomName: "Deluxe Twin",
        ratePlanId: 20,
        ratePlanName: "Breakfast",
        issues: [],
      }),
    ]);
    expect(prepared.proposal.lamasooPayload.items).toEqual([]);
  });
});
