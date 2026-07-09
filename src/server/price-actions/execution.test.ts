import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../db/prisma";
import { stringifyJson } from "../db/json";
import { executeConfirmedProposal } from "./execution";

const getPriceCapacityRows = vi.fn();
const upsertPriceCapacity = vi.fn();

vi.mock("../dummy-pms/client", () => ({
  getPriceCapacityRows: (...args: unknown[]) => getPriceCapacityRows(...args),
  upsertPriceCapacity: (...args: unknown[]) => upsertPriceCapacity(...args),
}));

describe("executeConfirmedProposal", function () {
  beforeEach(async function () {
    vi.clearAllMocks();
    await prisma.actionExecution.deleteMany();
    await prisma.actionProposal.deleteMany();
    await prisma.toolCall.deleteMany();
    await prisma.agentStep.deleteMany();
    await prisma.agentRun.deleteMany();
    await prisma.uploadedFile.deleteMany();
    await prisma.message.deleteMany();
    await prisma.chat.deleteMany();
  });

  it("fails without calling PMS when latest PMS values conflict", async function () {
    const proposalId = await createPendingProposal();
    getPriceCapacityRows.mockResolvedValue([
      {
        hotelId: 1,
        date: "2026-08-01",
        roomTypeProviderId: 31,
        price: {
          ratePlanId: 112,
          boardPrice: 601,
          displayPrice: 700,
        },
      },
    ]);

    const execution = await executeConfirmedProposal(proposalId);
    const proposal = await prisma.actionProposal.findUniqueOrThrow({
      where: { id: proposalId },
    });

    expect(execution.status).toBe("FAILED");
    expect(proposal.status).toBe("FAILED");
    expect(upsertPriceCapacity).not.toHaveBeenCalled();
    expect(execution.conflictJson).toContain("boardPrice");
  });

  it("prevents double execution", async function () {
    const proposalId = await createPendingProposal("EXECUTED");

    await expect(executeConfirmedProposal(proposalId)).rejects.toThrow(
      "cannot execute",
    );
  });
});

async function createPendingProposal(status = "PENDING"): Promise<string> {
  const chat = await prisma.chat.create({
    data: { title: "Test chat" },
  });
  const message = await prisma.message.create({
    data: {
      chatId: chat.id,
      role: "user",
      content: "Increase room prices by 10% for hotel 1",
    },
  });
  const run = await prisma.agentRun.create({
    data: {
      chatId: chat.id,
      messageId: message.id,
      status: "COMPLETED",
      inputJson: "{}",
    },
  });
  const proposal = await prisma.actionProposal.create({
    data: {
      chatId: chat.id,
      agentRunId: run.id,
      type: "PRICE_CAPACITY_UPSERT",
      status,
      title: "Increase room prices by 10%",
      summary: "Test proposal",
      hotelId: "1",
      affectedRowsCount: 1,
      assumptionsJson: stringifyJson([]),
      warningsJson: stringifyJson([]),
      diffsJson: stringifyJson([
        {
          rowId: "2026-08-01:31:112",
          roomTypeProviderId: 31,
          date: "2026-08-01",
          ratePlanId: 112,
          field: "boardPrice",
          oldValue: 600,
          newValue: 660,
        },
      ]),
      pmsPayloadJson: stringifyJson({
        items: [
          {
            date: "2026-08-01",
            roomTypeProviderId: 31,
            count: 2,
            price: {
              ratePlanId: 112,
              boardPrice: 660,
              displayPrice: 770,
            },
          },
        ],
      }),
      toolCallsJson: stringifyJson([]),
      oldValuesJson: stringifyJson([
        {
          rowId: "2026-08-01:31:112",
          date: "2026-08-01",
          roomTypeProviderId: 31,
          ratePlanId: 112,
          boardPrice: 600,
          displayPrice: 700,
        },
      ]),
    },
  });

  return proposal.id;
}
