import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../db/prisma";
import { stringifyJson } from "../db/json";
import { executeConfirmedProposal, rejectProposal } from "./execution";
import { getBundle, upsertPriceCapacity } from "../lamasoo/client";

vi.mock("../lamasoo/client", () => ({
  getBundle: vi.fn(),
  upsertPriceCapacity: vi.fn(),
}));

describe("Lamasoo proposal execution", function () {
  beforeEach(async function () {
    vi.clearAllMocks();
    vi.mocked(getBundle).mockResolvedValue({
      id: 30,
      name: "Summer",
      ratePlans: [
        {
          ratePlanId: 20,
          name: "Breakfast",
          roomRateBundles: [
            {
              ratePlanId: 20,
              roomTypeProviderId: 10,
              displayPrice: 7000000,
            },
          ],
        },
      ],
    });
    vi.mocked(upsertPriceCapacity).mockResolvedValue({ ok: true });
  });

  it("executes a confirmed Lamasoo payload after conflict checks", async function () {
    const proposal = await createPendingProposal({
      payload: {
        hotelId: 1,
        bundleId: 30,
        items: [
          {
            date: "2026-08-01",
            roomTypeProviderId: 10,
            price: { ratePlanId: 20, displayPrice: 7500000 },
          },
        ],
      },
      oldValues: [
        {
          rowId: "row-1",
          date: "2026-08-01",
          roomTypeProviderId: 10,
          ratePlanId: 20,
          field: "displayPrice",
          value: 7000000,
        },
      ],
    });

    await executeConfirmedProposal(proposal.id);

    expect(upsertPriceCapacity).toHaveBeenCalledWith(
      expect.any(Object),
      proposal.payload,
    );
    const updated = await prisma.actionProposal.findUnique({
      where: { id: proposal.id },
    });
    expect(updated?.status).toBe("EXECUTED");
  });

  it("fails without writing when Lamasoo bundle values changed", async function () {
    vi.mocked(getBundle).mockResolvedValue({
      id: 30,
      name: "Summer",
      ratePlans: [
        {
          ratePlanId: 20,
          name: "Breakfast",
          roomRateBundles: [
            {
              ratePlanId: 20,
              roomTypeProviderId: 10,
              displayPrice: 7100000,
            },
          ],
        },
      ],
    });
    const proposal = await createPendingProposal({
      payload: {
        hotelId: 1,
        bundleId: 30,
        items: [
          {
            date: "2026-08-01",
            roomTypeProviderId: 10,
            price: { ratePlanId: 20, displayPrice: 7500000 },
          },
        ],
      },
      oldValues: [
        {
          rowId: "row-1",
          date: "2026-08-01",
          roomTypeProviderId: 10,
          ratePlanId: 20,
          field: "displayPrice",
          value: 7000000,
        },
      ],
    });

    await executeConfirmedProposal(proposal.id);

    expect(upsertPriceCapacity).not.toHaveBeenCalled();
    const updated = await prisma.actionProposal.findUnique({
      where: { id: proposal.id },
    });
    expect(updated?.status).toBe("FAILED");
  });

  it("treats missing or non-number latest prices as zero during conflict checks", async function () {
    vi.mocked(getBundle).mockResolvedValue({
      id: 30,
      name: "Summer",
      ratePlans: [
        {
          ratePlanId: 20,
          name: "Breakfast",
          roomRateBundles: [
            {
              ratePlanId: 20,
              roomTypeProviderId: 10,
              displayPrice: "not-a-number",
            },
          ],
        },
      ],
    });
    const proposal = await createPendingProposal({
      payload: {
        hotelId: 1,
        bundleId: 30,
        items: [
          {
            date: "2026-08-01",
            roomTypeProviderId: 10,
            price: { ratePlanId: 20, displayPrice: 7500000 },
          },
        ],
      },
      oldValues: [
        {
          rowId: "row-1",
          date: "2026-08-01",
          roomTypeProviderId: 10,
          ratePlanId: 20,
          field: "displayPrice",
          value: 0,
        },
      ],
    });

    await executeConfirmedProposal(proposal.id);

    expect(upsertPriceCapacity).toHaveBeenCalledWith(
      expect.any(Object),
      proposal.payload,
    );
    const updated = await prisma.actionProposal.findUnique({
      where: { id: proposal.id },
    });
    expect(updated?.status).toBe("EXECUTED");
  });

  it("rejects a proposal without calling Lamasoo", async function () {
    const proposal = await createPendingProposal({
      payload: { hotelId: 1, bundleId: 30, items: [] },
      oldValues: [],
    });

    await rejectProposal(proposal.id);

    expect(upsertPriceCapacity).not.toHaveBeenCalled();
    const updated = await prisma.actionProposal.findUnique({
      where: { id: proposal.id },
    });
    expect(updated?.status).toBe("REJECTED");
  });
});

async function createPendingProposal(input: {
  payload: {
    hotelId: number;
    bundleId: number;
    items: Array<{
      date: string;
      roomTypeProviderId: number;
      price: { ratePlanId: number; displayPrice?: number };
    }>;
  };
  oldValues: unknown[];
}) {
  const chat = await prisma.chat.create({
    data: { title: `test-${crypto.randomUUID()}` },
  });
  const run = await prisma.agentRun.create({
    data: {
      chatId: chat.id,
      status: "COMPLETED",
      inputJson: "{}",
    },
  });
  const proposal = await prisma.actionProposal.create({
    data: {
      chatId: chat.id,
      agentRunId: run.id,
      type: "LAMASOO_RATE_PLAN_PRICE_UPDATE",
      status: "PENDING",
      title: "Review Lamasoo rate-plan price update",
      summary: "1 daily Lamasoo update item prepared for review.",
      hotelId: String(input.payload.hotelId),
      affectedRowsCount: input.payload.items.length,
      assumptionsJson: "[]",
      warningsJson: "[]",
      validationIssuesJson: "[]",
      diffsJson: "[]",
      lamasooPayloadJson: stringifyJson(input.payload),
      toolCallsJson: "[]",
      oldValuesJson: stringifyJson(input.oldValues),
    },
  });

  return {
    id: proposal.id,
    payload: input.payload,
  };
}
