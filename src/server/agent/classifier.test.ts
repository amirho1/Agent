import { describe, expect, it } from "vitest";
import { classifyAgentRequestHeuristically } from "./classifier";

describe("classifyAgentRequestHeuristically", function () {
  it("classifies knowledge questions", function () {
    expect(
      classifyAgentRequestHeuristically("What does stopSell mean?", {}),
    ).toBe("knowledge_answer");
  });

  it("classifies approved execution requests", function () {
    expect(
      classifyAgentRequestHeuristically("Approve and execute", {
        preparedPayload: {
          hotelId: 1,
          items: [],
        },
      }),
    ).toBe("execute_approved_action");
  });
});
