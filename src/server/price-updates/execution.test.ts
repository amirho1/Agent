import { describe, expect, it } from "vitest";
import type { ServerConfig } from "../config";
import { executeApprovedPriceCapacityUpdate } from "./execution";

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

describe("executeApprovedPriceCapacityUpdate", function () {
  it("blocks execution without approval", async function () {
    await expect(
      executeApprovedPriceCapacityUpdate(config, {
        approvalStatus: "pending",
        preparedPayload: {
          hotelId: 1,
          items: [
            {
              date: "2026-08-01",
              roomTypeProviderId: 31,
              price: {
                ratePlanId: 112,
                displayPrice: 7000000,
              },
            },
          ],
        },
      }),
    ).rejects.toThrow("Approval is required");
  });
});
