import { describe, expect, it } from "vitest";
import type {
  ExtractedRateSheet,
  PriceCapacityRecord,
} from "../../shared/agent-types";
import { createPriceDiffRows } from "./diff";
import { expandDateRange } from "./dates";
import { matchRoomsAndRatePlans } from "./matching";
import { preparePriceCapacityUpsert } from "./prepare";
import { validatePriceUpdate } from "./validation";

const extractedRateSheet: ExtractedRateSheet = {
  dateRanges: [
    {
      from: "2026-08-01",
      to: "2026-08-02",
      rooms: [
        {
          rowId: "row-1",
          roomName: "Deluxe Twin",
          ratePlanName: "HB USD Plan",
          displayPrice: 7000000,
          payablePrice: 5500000,
          count: 2,
        },
      ],
    },
  ],
};

describe("price update utilities", function () {
  it("expands date ranges inclusively", function () {
    expect(expandDateRange("2026-08-01", "2026-08-03")).toEqual([
      "2026-08-01",
      "2026-08-02",
      "2026-08-03",
    ]);
  });

  it("matches rooms and rate plans, validates rows, and prepares payload", function () {
    const matchedRows = matchRoomsAndRatePlans(
      extractedRateSheet,
      [
        {
          id: 31,
          hotelId: 1,
          name: "Deluxe Twin - Espinas Palace Tehran",
        },
      ],
      [
        {
          id: 112,
          hotelId: 1,
          name: "HB USD Plan",
        },
      ],
    );
    const issues = validatePriceUpdate(1, matchedRows);
    const payload = preparePriceCapacityUpsert(1, matchedRows, issues);

    expect(matchedRows[0].roomMatch.status).toBe("matched");
    expect(issues).toEqual([]);
    expect(payload.items).toHaveLength(2);
    expect(payload.items[0]).toMatchObject({
      date: "2026-08-01",
      roomTypeProviderId: 31,
      count: 2,
      price: {
        ratePlanId: 112,
        displayPrice: 7000000,
        payablePrice: 5500000,
      },
    });
  });

  it("creates changed diff rows against existing PMS data", function () {
    const matchedRows = matchRoomsAndRatePlans(
      extractedRateSheet,
      [{ id: 31, hotelId: 1, name: "Deluxe Twin - Espinas Palace Tehran" }],
      [{ id: 112, hotelId: 1, name: "HB USD Plan" }],
    );
    const existingRecords: PriceCapacityRecord[] = [
      {
        hotelId: 1,
        date: "2026-08-01",
        roomTypeProviderId: 31,
        count: 1,
        price: {
          ratePlanId: 112,
          displayPrice: 6000000,
          payablePrice: 5000000,
        },
      },
    ];
    const diffRows = createPriceDiffRows(matchedRows, existingRecords, []);

    expect(diffRows[0].status).toBe("changed");
    expect(diffRows[1].status).toBe("new");
  });
});
