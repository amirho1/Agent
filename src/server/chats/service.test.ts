import { beforeEach, describe, expect, it, vi } from "vitest";
import { createChat, processUserMessage } from "./service";
import { storeChatUpload } from "./uploads";
import {
  getBundle,
  listBundles,
  listHotels,
  listRatePlans,
  listRoomTypes,
} from "../lamasoo/client";

vi.mock("../lamasoo/client", () => ({
  getBundle: vi.fn(),
  listBundles: vi.fn(),
  listHotels: vi.fn(),
  listRatePlans: vi.fn(),
  listRoomTypes: vi.fn(),
}));

const sample = `
| hotel | title | from | to | currency |
|---|---|---|---|---|
| Aria Hotel | Summer | 2026-08-01 | 2026-08-01 | IRR |

| roomName | ratePlanName | displayPrice |
|---|---|---:|
| Deluxe Twin | BB | 7500000 |
`;

describe("chat Lamasoo proposal flow", function () {
  beforeEach(function () {
    vi.clearAllMocks();
    vi.mocked(listHotels).mockResolvedValue([{ id: 1, name: "Aria Hotel" }]);
    vi.mocked(listRoomTypes).mockResolvedValue([
      { id: 10, name: "Deluxe Twin" },
    ]);
    vi.mocked(listRatePlans).mockResolvedValue([
      { id: 20, name: "Breakfast", mealType: "BB" },
    ]);
    vi.mocked(listBundles).mockResolvedValue([
      { id: 30, name: "Summer", hotelProvider: { hotelId: 1 } },
    ]);
    vi.mocked(getBundle).mockResolvedValue({
      id: 30,
      name: "Summer",
      hotelProvider: { hotelId: 1 },
      ratePlans: [
        {
          ratePlanId: 20,
          name: "Breakfast",
          roomRateBundles: [
            {
              ratePlanId: 20,
              roomTypeProviderId: 10,
              displayPrice: 7000000,
              roomTypeProvider: {
                id: 10,
                name: "Deluxe Twin",
                roomType: { hotelId: 1 },
              },
            },
          ],
        },
      ],
    });
  });

  it("creates a persisted proposal from chat text", async function () {
    const details = await createChat();
    const nextDetails = await processUserMessage(details.chat.id, sample);

    expect(nextDetails.actionProposals[0]).toMatchObject({
      type: "LAMASOO_RATE_PLAN_PRICE_UPDATE",
      status: "PENDING",
      hotelId: "1",
      bundleId: 30,
      affectedRowsCount: 1,
      validationIssues: [],
    });
    expect(
      nextDetails.actionProposals[0].lamasooPayload.items[0],
    ).toMatchObject({
      date: "2026-08-01",
      roomTypeProviderId: 10,
      price: { ratePlanId: 20, displayPrice: 7500000 },
    });
  });

  it("creates a persisted proposal from Markdown upload", async function () {
    const details = await createChat();
    const file = new File([sample], "rates.md", { type: "text/markdown" });
    const nextDetails = await storeChatUpload(details.chat.id, file);

    expect(nextDetails.uploadedFiles[0]).toMatchObject({
      fileName: "rates.md",
      contentType: "text/markdown",
    });
    expect(nextDetails.actionProposals[0].affectedRowsCount).toBe(1);
  });
});
