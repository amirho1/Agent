import { describe, expect, it } from "vitest";
import { parseRateSheetText } from "./parser";

describe("parseRateSheetText", function () {
  it("parses a Markdown rate sheet table", function () {
    const result = parseRateSheetText(`
| from | to | roomName | ratePlanName | boardPrice | displayPrice | payablePrice | count |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-08-01 | 2026-08-02 | Deluxe Twin | HB USD Plan | 6000000 | 7000000 | 5500000 | 2 |
`);

    expect(result.issues).toEqual([]);
    expect(result.extractedRateSheet.dateRanges).toHaveLength(1);
    expect(result.extractedRateSheet.dateRanges[0].rooms[0]).toMatchObject({
      roomName: "Deluxe Twin",
      ratePlanName: "HB USD Plan",
      boardPrice: 6000000,
      displayPrice: 7000000,
      payablePrice: 5500000,
      count: 2,
    });
  });

  it("returns validation issues for missing required data", function () {
    const result = parseRateSheetText(`
from,to,roomName,displayPrice
bad-date,2026-08-02,,7000000
`);

    expect(result.issues.some((issue) => issue.level === "error")).toBe(true);
    expect(result.issues.map((issue) => issue.field)).toContain("from");
    expect(result.issues.map((issue) => issue.field)).toContain("roomName");
  });
});
