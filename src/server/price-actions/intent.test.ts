import { describe, expect, it } from "vitest";
import { extractPriceUpdateIntent } from "./intent";

describe("extractPriceUpdateIntent", function () {
  it("extracts the required increase demo request", function () {
    const result = extractPriceUpdateIntent(
      "Increase room prices by 10% for hotel 1.",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.intent).toMatchObject({
        hotelId: 1,
        percent: 10,
        direction: "increase",
        priceFilters: [],
      });
    }
  });

  it("extracts a filtered display price request", function () {
    const result = extractPriceUpdateIntent(
      "Increase prices by 5% for rooms where the current display price is more than 10 dollars for hotel 1.",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.intent.priceFilters).toEqual([
        {
          field: "displayPrice",
          operator: "gt",
          value: 10,
        },
      ]);
    }
  });

  it("asks for clarification when hotel ID is missing", function () {
    const result = extractPriceUpdateIntent("Increase room prices by 10%.");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.isPriceUpdateRequest).toBe(true);
      expect(result.clarification).toMatch(/hotel ID/);
    }
  });
});
