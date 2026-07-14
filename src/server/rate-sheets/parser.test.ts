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

  it("parses demo arwerk sheet metadata, Persian package rows, and row dates", function () {
    const result = parseRateSheetText(`
# نرخ‌نامه آزمایشی هتل دمو arwerk

- واحد پول: ریال (IRR)

title عادی
start date: 26-07-14
end date: 26-07-29

| نام پکیج | از تاریخ | تا تاریخ | نوع اتاق | ظرفیت پایه | کد نرخ‌نامه | شرح نرخ‌نامه | قیمت قابل‌پرداخت | قیمت برد | قیمت نمایش | قیمت نفر اضافه | قیمت کودک با تخت | قیمت کودک بدون تخت |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| پکیج تابستان A | 2026-08-01 | 2026-08-31 | اتاق یک‌تخته اقتصادی | 1 | RO | فقط اتاق | 18,000,000 | 18,900,000 | 20,200,000 | 6,000,000 | 4,500,000 | 2,100,000 |
| پکیج تابستان B | 2026-09-01 | 2026-09-15 | اتاق دوتخته توئین استاندارد | 2 | BB | همراه صبحانه | 32,200,000 | 33,800,000 | 36,100,000 | 9,200,000 | 6,900,000 | 3,200,000 |
`);

    expect(result.issues).toEqual([
      {
        level: "error",
        field: "hotelName",
        message: "Hotel name is required.",
      },
    ]);
    expect(result.extractedRateSheet).toMatchObject({
      title: "عادی",
      from: "2026-07-14",
      to: "2026-07-29",
      currency: "ریال (IRR)",
    });
    expect(result.extractedRateSheet.rows).toEqual([
      expect.objectContaining({
        from: "2026-08-01",
        to: "2026-08-31",
        roomName: "اتاق یک‌تخته اقتصادی",
        ratePlanName: "RO",
        payablePrice: 18000000,
        boardPrice: 18900000,
        displayPrice: 20200000,
      }),
      expect.objectContaining({
        from: "2026-09-01",
        to: "2026-09-15",
        roomName: "اتاق دوتخته توئین استاندارد",
        ratePlanName: "BB",
        payablePrice: 32200000,
        boardPrice: 33800000,
        displayPrice: 36100000,
      }),
    ]);
  });

  it("normalizes Persian digits, money, ISO, and Jalali dates", function () {
    expect(toEnglishDigits("۱۴۰۵/۰۴/۲۱")).toBe("1405/04/21");
    expect(parseOptionalNumber("۱۸,۰۰۰,۰۰۰")).toBe(18000000);
    expect(normalizeDate("2026-08-01")).toBe("2026-08-01");
    expect(normalizeDate("26-07-14")).toBe("2026-07-14");
    expect(normalizeDate("۱۴۰۵/۰۴/۲۱")).toBe("2026-07-12");
  });
});
