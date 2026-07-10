import { describe, expect, it } from "vitest";
import { extractPmsActionIntent } from "./intent";

describe("extractPmsActionIntent", function () {
  it("extracts cheapest room read requests", function () {
    const result = extractPmsActionIntent("Show hotel 3 10 cheapest rooms.");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.intent).toMatchObject({
        type: "ROOM_SORT",
        hotelId: 3,
        sort: "CHEAPEST",
        limit: 10,
      });
    }
  });

  it("extracts fixed price updates for the cheapest rooms", function () {
    const result = extractPmsActionIntent(
      "Find two cheapest rooms in hotel 3 and add 3 dollars to their display price.",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.intent).toMatchObject({
        type: "PRICE_CAPACITY_UPDATE",
        hotelId: 3,
        fields: ["displayPrice"],
        operation: {
          type: "DELTA",
          direction: "increase",
          value: 3,
        },
        selection: {
          sort: "CHEAPEST",
          limit: 2,
        },
      });
    }
  });

  it("extracts all-price percentage updates for the most expensive rooms", function () {
    const result = extractPmsActionIntent(
      "for hotel 1 decrease all prices of 3 most expensive rooms by 10 percent",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.intent).toMatchObject({
        type: "PRICE_CAPACITY_UPDATE",
        hotelId: 1,
        fields: ["boardPrice", "displayPrice", "payablePrice"],
        operation: {
          type: "PERCENT_CHANGE",
          direction: "decrease",
          value: 10,
        },
        selection: {
          sort: "MOST_EXPENSIVE",
          limit: 3,
        },
      });
    }
  });

  it("extracts all-price updates for named room filters", function () {
    const result = extractPmsActionIntent(
      "Increase all prices by 10% for all double rooms in hotel 1.",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.intent).toMatchObject({
        type: "PRICE_CAPACITY_UPDATE",
        hotelId: 1,
        fields: ["boardPrice", "displayPrice", "payablePrice"],
        selection: {
          name: "double",
        },
      });
    }
  });

  it("extracts multiply price updates as a fallback", function () {
    const result = extractPmsActionIntent(
      "Increase hotel 1 rooms by multiplying all prices with 2",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.intent).toMatchObject({
        type: "PRICE_CAPACITY_UPDATE",
        hotelId: 1,
        fields: ["boardPrice", "displayPrice", "payablePrice"],
        operation: {
          type: "MULTIPLY",
          value: 2,
        },
      });
    }
  });

  it("asks for price-field clarification for generic price updates", function () {
    const result = extractPmsActionIntent(
      "Increase room prices by 10% for hotel 1.",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.clarification).toMatch(/price field/);
    }
  });

  it("extracts first-room limits for read requests", function () {
    const result = extractPmsActionIntent("Show hotel 3 first 5 rooms.");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.intent).toMatchObject({
        type: "ROOM_LIST",
        hotelId: 3,
        limit: 5,
      });
    }
  });

  it("extracts all-room read requests without a limit", function () {
    const result = extractPmsActionIntent("All rooms in hotel 3.");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.intent).toMatchObject({
        type: "ROOM_LIST",
        hotelId: 3,
      });
      expect(
        "limit" in result.intent ? result.intent.limit : undefined,
      ).toBeUndefined();
    }
  });

  it("extracts exact room targets for price updates", function () {
    const result = extractPmsActionIntent(
      "Set board price to 100 for room 4 in hotel 3.",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.intent).toMatchObject({
        type: "PRICE_CAPACITY_UPDATE",
        hotelId: 3,
        fields: ["boardPrice"],
        operation: {
          type: "SET",
          value: 100,
        },
        selection: {
          roomId: 4,
        },
      });
    }
  });

  it("extracts room name edits", function () {
    const result = extractPmsActionIntent(
      "Edit room 5 name to Deluxe Double Room.",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.intent).toMatchObject({
        type: "ROOM_UPDATE",
        roomId: 5,
        update: { name: "Deluxe Double Room" },
      });
    }
  });

  it("extracts room creation requests", function () {
    const result = extractPmsActionIntent(
      "Add VIP Suite to hotel 3 with default count 2.",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.intent).toMatchObject({
        type: "ROOM_CREATE",
        hotelId: 3,
        name: "VIP Suite",
        defaultCount: 2,
      });
    }
  });

  it("extracts hard delete requests", function () {
    const result = extractPmsActionIntent("Delete room 7.");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.intent).toMatchObject({
        type: "ROOM_DELETE",
        roomId: 7,
      });
    }
  });

  it("asks for hotel clarification when a room list omits hotel ID", function () {
    const result = extractPmsActionIntent("Show cheapest rooms.");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.clarification).toMatch(/hotel ID/);
    }
  });
});
