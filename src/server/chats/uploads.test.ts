import { describe, expect, it } from "vitest";
import { isSupportedUpload } from "./uploads";

describe("isSupportedUpload", function () {
  it("accepts text and markdown files", function () {
    expect(isSupportedUpload({ name: "rates.txt" })).toBe(true);
    expect(isSupportedUpload({ name: "rates.md" })).toBe(true);
  });

  it("rejects unsupported files", function () {
    expect(isSupportedUpload({ name: "rates.pdf" })).toBe(false);
    expect(isSupportedUpload({ name: "rates.xlsx" })).toBe(false);
  });
});
