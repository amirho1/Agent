import { describe, expect, it, vi } from "vitest";
import type { ServerConfig } from "../config";
import { prepareRoomReadResult } from "./read-result";
import {
  preparePriceOperationProposal,
  prepareRoomDeleteProposal,
  prepareRoomUpdateProposal,
} from "./proposal";

vi.mock("../dummy-pms/client", () => ({
  getHotels: vi.fn(async () => [{ id: 3, name: "Kish Marina Resort" }]),
  getHotelRooms: vi.fn(async () => [
    {
      id: 5,
      hotelId: 3,
      name: "Standard Room",
      defaultCount: 2,
      isActive: true,
    },
    {
      id: 6,
      hotelId: 3,
      name: "Budget Double",
      defaultCount: 1,
      isActive: true,
    },
    { id: 7, hotelId: 3, name: "VIP Suite", defaultCount: 2, isActive: true },
  ]),
  getRoomById: vi.fn(async () => ({
    id: 5,
    hotelId: 3,
    name: "Standard Room",
    defaultCount: 2,
    isActive: true,
  })),
  getRatePlans: vi.fn(async () => [{ id: 201, hotelId: 3, name: "BB USD" }]),
  getPriceCapacityRows: vi.fn(async () => [
    {
      id: 1,
      hotelId: 3,
      date: "2026-08-01",
      roomTypeProviderId: 5,
      count: 2,
      price: { ratePlanId: 201, displayPrice: 100, boardPrice: 90 },
    },
    {
      id: 2,
      hotelId: 3,
      date: "2026-08-01",
      roomTypeProviderId: 6,
      count: 2,
      price: { ratePlanId: 201, displayPrice: 80, boardPrice: 70 },
    },
    {
      id: 3,
      hotelId: 3,
      date: "2026-08-02",
      roomTypeProviderId: 5,
      count: 2,
      price: { ratePlanId: 201, displayPrice: 85, boardPrice: 80 },
    },
    {
      id: 4,
      hotelId: 3,
      date: "2026-08-02",
      roomTypeProviderId: 6,
      count: 2,
      price: { ratePlanId: 201, displayPrice: 82, boardPrice: 74 },
    },
    {
      id: 5,
      hotelId: 3,
      date: "2026-08-02",
      roomTypeProviderId: 7,
      count: 2,
      price: { ratePlanId: 201, displayPrice: 90, boardPrice: 80 },
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

describe("pms action preparation", function () {
  it("prepares a read-only cheapest-room result", async function () {
    const prepared = await prepareRoomReadResult(config, {
      type: "ROOM_SORT",
      hotelId: 3,
      sort: "CHEAPEST",
      limit: 1,
    });

    expect(prepared.readResult.matchedRowsCount).toBe(1);
    expect(prepared.readResult.rows[0]).toMatchObject({
      roomId: 6,
      name: "Budget Double",
      lowestDisplayPrice: 80,
    });
  });

  it("prepares a room update proposal", async function () {
    const prepared = await prepareRoomUpdateProposal(config, {
      type: "ROOM_UPDATE",
      roomId: 5,
      update: { name: "Deluxe Double Room" },
    });

    expect(prepared.proposal.type).toBe("ROOM_UPDATE");
    expect(prepared.proposal.diffs).toMatchObject([
      {
        action: "UPDATE",
        entityType: "ROOM",
        rowId: "5",
        field: "name",
        oldValue: "Standard Room",
        newValue: "Deluxe Double Room",
      },
    ]);
  });

  it("prepares fixed display-price updates for selected cheapest rooms", async function () {
    const prepared = await preparePriceOperationProposal(config, {
      type: "PRICE_CAPACITY_UPDATE",
      hotelId: 3,
      selection: {
        type: "ROOM_SORT",
        hotelId: 3,
        sort: "CHEAPEST",
        limit: 1,
      },
      fields: ["displayPrice"],
      operation: {
        type: "DELTA",
        direction: "increase",
        value: 3,
      },
    });

    const payload = prepared.proposal.pmsPayload;

    expect(prepared.proposal.affectedRowsCount).toBe(2);
    expect("items" in payload).toBe(true);
    if (!("items" in payload)) {
      throw new Error("Expected price-capacity payload items.");
    }

    expect(payload.items).toMatchObject([
      {
        date: "2026-08-01",
        roomTypeProviderId: 6,
        price: { displayPrice: 83 },
      },
      {
        date: "2026-08-02",
        roomTypeProviderId: 6,
        price: { displayPrice: 85 },
      },
    ]);
    expect(prepared.proposal.diffs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityType: "PRICE_CAPACITY",
          roomTypeProviderId: 6,
          field: "displayPrice",
          oldValue: 80,
          newValue: 83,
        }),
        expect.objectContaining({
          entityType: "PRICE_CAPACITY",
          roomTypeProviderId: 6,
          field: "displayPrice",
          oldValue: 82,
          newValue: 85,
        }),
      ]),
    );
  });

  it("prepares multiply updates for explicit price fields", async function () {
    const prepared = await preparePriceOperationProposal(config, {
      type: "PRICE_CAPACITY_UPDATE",
      hotelId: 3,
      selection: {
        type: "ROOM_LIST",
        hotelId: 3,
      },
      fields: ["boardPrice", "displayPrice"],
      operation: {
        type: "MULTIPLY",
        value: 2,
      },
    });

    expect(prepared.proposal.diffs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "displayPrice",
          oldValue: 100,
          newValue: 200,
        }),
        expect.objectContaining({
          field: "boardPrice",
          oldValue: 90,
          newValue: 180,
        }),
      ]),
    );
    expect(prepared.proposal.assumptions.join(" ")).toMatch(
      /Multiple price fields were requested/,
    );
  });

  it("selects distinct most-expensive rooms before expanding price rows", async function () {
    const prepared = await preparePriceOperationProposal(config, {
      type: "PRICE_CAPACITY_UPDATE",
      hotelId: 3,
      selection: {
        type: "ROOM_SORT",
        hotelId: 3,
        sort: "MOST_EXPENSIVE",
        limit: 2,
      },
      fields: ["boardPrice", "displayPrice"],
      operation: {
        type: "PERCENT_CHANGE",
        direction: "decrease",
        value: 10,
      },
    });

    const payload = prepared.proposal.pmsPayload;

    expect(prepared.proposal.affectedRowsCount).toBe(3);
    expect("items" in payload).toBe(true);
    if (!("items" in payload)) {
      throw new Error("Expected price-capacity payload items.");
    }

    expect(payload.items).toHaveLength(3);
    expect(payload.items).toMatchObject([
      {
        date: "2026-08-01",
        roomTypeProviderId: 5,
        price: { boardPrice: 81, displayPrice: 90 },
      },
      {
        date: "2026-08-02",
        roomTypeProviderId: 5,
        price: { boardPrice: 72, displayPrice: 76.5 },
      },
      {
        date: "2026-08-02",
        roomTypeProviderId: 7,
        price: { boardPrice: 72, displayPrice: 81 },
      },
    ]);
    expect(prepared.proposal.diffs).toHaveLength(6);
    expect(prepared.proposal.diffs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          date: "2026-08-01",
          field: "boardPrice",
          oldValue: 90,
          newValue: 81,
        }),
        expect.objectContaining({
          date: "2026-08-01",
          field: "displayPrice",
          oldValue: 100,
          newValue: 90,
        }),
        expect.objectContaining({
          date: "2026-08-02",
          roomTypeProviderId: 5,
          field: "displayPrice",
          oldValue: 85,
          newValue: 76.5,
        }),
        expect.objectContaining({
          date: "2026-08-02",
          field: "boardPrice",
          oldValue: 80,
          newValue: 72,
        }),
        expect.objectContaining({
          date: "2026-08-02",
          field: "displayPrice",
          oldValue: 90,
          newValue: 81,
        }),
      ]),
    );
    expect(prepared.proposal.summary).toMatch(
      /3 price-capacity rows across 2 selected rooms/,
    );
    expect(prepared.proposal.assumptions.join(" ")).toMatch(
      /Selected 2 matching rooms and generated 3 executable price-capacity rows/,
    );
  });

  it("warns when fewer matching rooms exist than requested", async function () {
    const prepared = await preparePriceOperationProposal(config, {
      type: "PRICE_CAPACITY_UPDATE",
      hotelId: 3,
      selection: {
        type: "ROOM_SORT",
        hotelId: 3,
        sort: "CHEAPEST",
        limit: 5,
      },
      fields: ["displayPrice"],
      operation: {
        type: "PERCENT_CHANGE",
        direction: "increase",
        value: 10,
      },
    });

    expect(prepared.proposal.affectedRowsCount).toBe(5);
    expect(prepared.proposal.warnings).toContain(
      "You requested 5 rooms, but only 3 matching rooms exist.",
    );
    expect(prepared.proposal.diffs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          roomTypeProviderId: 6,
          field: "displayPrice",
          oldValue: 80,
          newValue: 88,
        }),
      ]),
    );
  });

  it("does not prepare a price proposal when no rooms match", async function () {
    await expect(
      preparePriceOperationProposal(config, {
        type: "PRICE_CAPACITY_UPDATE",
        hotelId: 3,
        selection: {
          type: "ROOM_FILTER",
          hotelId: 3,
          name: "Missing",
        },
        fields: ["displayPrice"],
        operation: {
          type: "PERCENT_CHANGE",
          direction: "increase",
          value: 10,
        },
      }),
    ).rejects.toThrow(/No matching PMS rooms/);
  });

  it("prepares cap updates only for rows above the cap", async function () {
    const prepared = await preparePriceOperationProposal(config, {
      type: "PRICE_CAPACITY_UPDATE",
      hotelId: 3,
      selection: {
        type: "ROOM_LIST",
        hotelId: 3,
      },
      fields: ["displayPrice"],
      operation: {
        type: "CAP_AT",
        value: 90,
      },
    });

    expect(prepared.proposal.diffs).toHaveLength(1);
    expect(prepared.proposal.diffs[0]).toMatchObject({
      field: "displayPrice",
      oldValue: 100,
      newValue: 90,
    });
  });

  it("warns before hard-deleting rooms with linked price rows", async function () {
    const prepared = await prepareRoomDeleteProposal(config, {
      type: "ROOM_DELETE",
      hotelId: 3,
      roomId: 5,
    });

    expect(prepared.proposal.type).toBe("ROOM_DELETE");
    expect(prepared.proposal.warnings.join(" ")).toMatch(/linked/);
  });
});
