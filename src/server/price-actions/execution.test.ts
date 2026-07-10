import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../db/prisma";
import { stringifyJson } from "../db/json";
import { executeConfirmedProposal } from "./execution";

const getPriceCapacityRows = vi.fn();
const upsertPriceCapacity = vi.fn();
const getRoomById = vi.fn();
const executeUpdateRoom = vi.fn();

vi.mock("../dummy-pms/client", () => ({
  getPriceCapacityRows: (...args: unknown[]) => getPriceCapacityRows(...args),
  upsertPriceCapacity: (...args: unknown[]) => upsertPriceCapacity(...args),
  getRoomById: (...args: unknown[]) => getRoomById(...args),
  executeUpdateRoom: (...args: unknown[]) => executeUpdateRoom(...args),
  executeCreateRoom: vi.fn(),
  executeDeactivateRoom: vi.fn(),
  executeDeleteRoom: vi.fn(),
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

  it("executes a confirmed room update after rechecking current PMS data", async function () {
    const proposalId = await createPendingRoomUpdateProposal();
    getRoomById.mockResolvedValue({
      id: 5,
      hotelId: 3,
      name: "Standard Room",
      defaultCount: 2,
      isActive: true,
    });
    executeUpdateRoom.mockResolvedValue({
      id: 5,
      hotelId: 3,
      name: "Deluxe Double Room",
      defaultCount: 2,
      isActive: true,
    });

    const execution = await executeConfirmedProposal(proposalId);
    const proposal = await prisma.actionProposal.findUniqueOrThrow({
      where: { id: proposalId },
    });

    expect(execution.status).toBe("EXECUTED");
    expect(proposal.status).toBe("EXECUTED");
    expect(executeUpdateRoom).toHaveBeenCalledWith(
      expect.anything(),
      3,
      5,
      { name: "Deluxe Double Room" },
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

async function createPendingRoomUpdateProposal(): Promise<string> {
  const chat = await prisma.chat.create({
    data: { title: "Test chat" },
  });
  const message = await prisma.message.create({
    data: {
      chatId: chat.id,
      role: "user",
      content: "Edit room 5 name to Deluxe Double Room",
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
      type: "ROOM_UPDATE",
      status: "PENDING",
      title: "Update room 5",
      summary: "Test room proposal",
      hotelId: "3",
      affectedRowsCount: 1,
      assumptionsJson: stringifyJson([]),
      warningsJson: stringifyJson([]),
      diffsJson: stringifyJson([
        {
          action: "UPDATE",
          entityType: "ROOM",
          rowId: "5",
          field: "name",
          oldValue: "Standard Room",
          newValue: "Deluxe Double Room",
        },
      ]),
      pmsPayloadJson: stringifyJson({
        action: "UPDATE_ROOM",
        hotelId: 3,
        roomId: 5,
        update: { name: "Deluxe Double Room" },
      }),
      toolCallsJson: stringifyJson([]),
      oldValuesJson: stringifyJson([
        {
          entityType: "ROOM",
          rowId: "5",
          hotelId: 3,
          roomId: 5,
          values: {
            name: "Standard Room",
          },
        },
      ]),
    },
  });

  return proposal.id;
}
