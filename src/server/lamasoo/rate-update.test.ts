import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerConfig } from "../config";
import {
  matchRatePlan,
  prepareLamasooRateUpdateProposal,
} from "./rate-update";
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
    vi.mocked(listHotels).mockResolvedValue([{ id: 1, name: "Aria Hotel" }]);
    vi.mocked(listRoomTypes).mockResolvedValue([
      { id: 10, name: "Deluxe Twin" },
    ]);
    vi.mocked(listRatePlans).mockResolvedValue([
      { id: 20, name: "Breakfast", mealType: "BB", currency: "IRR" },
      { id: 21, name: "Room Only", mealType: "RO", currency: "IRR" },
    ]);
    vi.mocked(listBundles).mockResolvedValue([{ id: 30, name: "Summer" }]);
    vi.mocked(getBundle).mockResolvedValue({
      id: 30,
      name: "Summer",
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

  it("blocks missing hotels and bundles instead of guessing", async function () {
    vi.mocked(listHotels).mockResolvedValue([{ id: 2, name: "Other Hotel" }]);

    const prepared = await prepareLamasooRateUpdateProposal(
      config,
      `
hotel: Aria Hotel
title: Summer
from: 2026-08-01
to: 2026-08-01
room=Deluxe Twin, ratePlan=BB, displayPrice=7000000
`,
    );

    expect(prepared.proposal.affectedRowsCount).toBe(0);
    expect(prepared.proposal.diffs[0]).toMatchObject({
      status: "error",
      roomName: "Deluxe Twin",
      ratePlanName: "BB",
    });
    expect(prepared.proposal.title).toMatch(/Clarification/);
  });
});
