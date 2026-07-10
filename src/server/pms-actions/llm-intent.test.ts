import { describe, expect, it } from "vitest";
import { convertLlmIntentToPmsIntent, llmPmsIntentSchema } from "./llm-intent";

describe("llm PMS intent conversion", function () {
  it("converts multiply price intents", function () {
    const parsed = llmPmsIntentSchema.parse({
      type: "PRICE_CAPACITY_UPDATE",
      reason: "User asked to multiply hotel room prices.",
      hotelId: 1,
      roomQuery: {
        hotelId: 1,
      },
      priceFields: ["boardPrice", "displayPrice"],
      priceOperation: {
        type: "MULTIPLY",
        value: 2,
      },
    });

    const result = convertLlmIntentToPmsIntent(parsed);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.intent).toMatchObject({
        type: "PRICE_CAPACITY_UPDATE",
        hotelId: 1,
        fields: ["boardPrice", "displayPrice"],
        operation: {
          type: "MULTIPLY",
          value: 2,
        },
      });
    }
  });

  it("converts divide price intents", function () {
    const parsed = llmPmsIntentSchema.parse({
      type: "PRICE_CAPACITY_UPDATE",
      reason: "User asked to divide display price.",
      hotelId: 1,
      priceFields: ["displayPrice"],
      priceOperation: {
        type: "DIVIDE",
        value: 2,
      },
    });

    const result = convertLlmIntentToPmsIntent(parsed);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.intent).toMatchObject({
        operation: {
          type: "DIVIDE",
          value: 2,
        },
      });
    }
  });

  it("converts set display price intents", function () {
    const parsed = llmPmsIntentSchema.parse({
      type: "PRICE_CAPACITY_UPDATE",
      reason: "User asked to set display price.",
      hotelId: 1,
      priceFields: ["displayPrice"],
      priceOperation: {
        type: "SET",
        value: 100,
      },
    });

    const result = convertLlmIntentToPmsIntent(parsed);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.intent).toMatchObject({
        fields: ["displayPrice"],
        operation: {
          type: "SET",
          value: 100,
        },
      });
    }
  });

  it("preserves numeric ranking and explicit room targets", function () {
    const parsed = llmPmsIntentSchema.parse({
      type: "PRICE_CAPACITY_UPDATE",
      reason: "User asked for the two cheapest rooms.",
      hotelId: 3,
      roomQuery: {
        hotelId: 3,
        sort: "CHEAPEST",
        limit: 2,
        roomId: 4,
      },
      priceFields: ["displayPrice"],
      priceOperation: {
        type: "PERCENT_CHANGE",
        direction: "increase",
        value: 10,
      },
    });

    const result = convertLlmIntentToPmsIntent(parsed);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.intent).toMatchObject({
        type: "PRICE_CAPACITY_UPDATE",
        hotelId: 3,
        fields: ["displayPrice"],
        operation: {
          type: "PERCENT_CHANGE",
          direction: "increase",
          value: 10,
        },
        selection: {
          roomId: 4,
          sort: "CHEAPEST",
          limit: 2,
        },
      });
    }
  });

  it("rejects invalid LLM output", function () {
    const result = llmPmsIntentSchema.safeParse({
      type: "PRICE_CAPACITY_UPDATE",
      reason: "Bad output",
      hotelId: 1,
      priceFields: ["displayPrice"],
      priceOperation: {
        type: "MYSTERY_OPERATION",
        value: 100,
      },
    });

    expect(result.success).toBe(false);
  });

  it("asks for clarification when a price update lacks fields", function () {
    const parsed = llmPmsIntentSchema.parse({
      type: "PRICE_CAPACITY_UPDATE",
      reason: "User asked to set a price but omitted field.",
      hotelId: 1,
      priceOperation: {
        type: "SET",
        value: 100,
      },
    });

    const result = convertLlmIntentToPmsIntent(parsed);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.clarification).toMatch(/price field/);
    }
  });
});
