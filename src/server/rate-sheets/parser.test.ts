import { describe, expect, it } from "vitest";
import {
  normalizeDate,
  parseOptionalNumber,
  parseRateSheetText,
  toEnglishDigits,
} from "./parser";

describe("parseRateSheetText", function () {
  it("parses Lamasoo Markdown metadata and Persian rate rows", function () {
    const result = parseRateSheetText(`
| نام هتل | عنوان نرخنامه | تاریخ شروع | تاریخ پایان | واحد پول |
|---|---|---|---|---|
| هتل الماسو تستی آریا | نرخنامه تابستان ۱۴۰۵ | ۱۴۰۵/۰۴/۲۱ | ۱۴۰۵/۰۵/۱۰ | ریال |

| نام اتاق | نرخنامه | قیمت برد | قیمت نمایش | قیمت قابل پرداخت | قیمت نفر اضافه |
|---|---|---:|---:|---:|---:|
| اتاق یک‌تخته اقتصادی | RO | ۱۶,۰۰۰,۰۰۰ | ۱۸,۰۰۰,۰۰۰ | ۱۵,۵۰۰,۰۰۰ | ۰ |
`);

    expect(result.issues).toEqual([]);
    expect(result.extractedRateSheet).toMatchObject({
      hotelName: "هتل الماسو تستی آریا",
      title: "نرخنامه تابستان ۱۴۰۵",
      from: "2026-07-12",
      to: "2026-08-01",
      currency: "ریال",
    });
    expect(result.extractedRateSheet.rows[0]).toMatchObject({
      roomName: "اتاق یک‌تخته اقتصادی",
      ratePlanName: "RO",
      boardPrice: 16000000,
      displayPrice: 18000000,
      payablePrice: 15500000,
    });
  });

  it("blocks generic price fields", function () {
    const result = parseRateSheetText(`
hotel: Aria
title: Summer
from: 2026-08-01
to: 2026-08-01
room=Deluxe Twin, ratePlan=BB, price=7000000
`);

    expect(result.issues.map((issue) => issue.field)).toContain("price");
    expect(result.extractedRateSheet.rows[0].genericPrice).toBe(7000000);
  });

  it("normalizes Persian digits, money, ISO, and Jalali dates", function () {
    expect(toEnglishDigits("۱۴۰۵/۰۴/۲۱")).toBe("1405/04/21");
    expect(parseOptionalNumber("۱۸,۰۰۰,۰۰۰")).toBe(18000000);
    expect(normalizeDate("2026-08-01")).toBe("2026-08-01");
    expect(normalizeDate("۱۴۰۵/۰۴/۲۱")).toBe("2026-07-12");
  });
});
