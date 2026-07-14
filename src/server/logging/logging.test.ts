import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LamasooPriceCapacityPayload } from "@/src/shared/agent-types";
import { prisma } from "../db/prisma";
import { stringifyJson } from "../db/json";
import { fetchJson } from "../http";
import {
  createLoggingSystem,
  closeLoggingSystem,
  dailyLogFileName,
  resetLoggingSystemForTests,
  setLoggingSystemForTests,
} from "./logger";
import { REDACTED_VALUE, sanitizeForLogging } from "./redaction";
import { getRequestId, runWithRequestContext } from "./context";
import { withApiLogging } from "./http-route";
import {
  getBundle,
  getCurrentHotel,
  listBundles,
  listRatePlans,
  listRoomTypes,
  upsertPriceCapacity,
} from "../lamasoo/client";
import { createChat } from "../chats/service";
import { storeChatUpload } from "../chats/uploads";
import { executeConfirmedProposal } from "../price-actions/execution";

vi.mock("../lamasoo/client", () => ({
  getBundle: vi.fn(),
  getCurrentHotel: vi.fn(),
  listBundles: vi.fn(),
  listRatePlans: vi.fn(),
  listRoomTypes: vi.fn(),
  upsertPriceCapacity: vi.fn(),
}));

const tempDirs: string[] = [];

describe.sequential("Pino logging", function () {
  beforeEach(function () {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    resetLoggingSystemForTests();
    mockLamasooClients();
  });

  afterEach(async function () {
    resetLoggingSystemForTests();
    vi.unstubAllGlobals();
    await Promise.all(
      tempDirs
        .splice(0)
        .map((dir) => rm(dir, { force: true, recursive: true })),
    );
  });

  it("creates separate daily app, access, and error logs", async function () {
    const system = createLoggingSystem({
      logDir: await makeTempLogDir(),
      nodeEnv: "test",
      enableConsole: false,
    });

    system.appLogger.info({ event: "test.app" }, "app log");
    system.accessLogger.info({ event: "test.access" }, "access log");
    system.errorLogger.error({ err: new Error("boom") }, "error log");
    await closeLoggingSystem(system);

    expect(dailyLogFileName("app", new Date("2026-07-11T12:00:00"))).toBe(
      "app-2026-07-11.log",
    );
    expect(await readLogEntries(system.logDir, "app")).toEqual(
      expect.arrayContaining([expect.objectContaining({ event: "test.app" })]),
    );
    expect(await readLogEntries(system.logDir, "access")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event: "test.access" }),
      ]),
    );
    expect(await readLogEntries(system.logDir, "error")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          msg: "error log",
          err: expect.objectContaining({
            stack: expect.stringContaining("boom"),
          }),
        }),
      ]),
    );
  });

  it("persists logs when the logging system is recreated", async function () {
    const logDir = await makeTempLogDir();
    const first = createLoggingSystem({
      logDir,
      nodeEnv: "test",
      enableConsole: false,
    });
    first.appLogger.info({ event: "first.write" }, "first");
    await closeLoggingSystem(first);

    const second = createLoggingSystem({
      logDir,
      nodeEnv: "test",
      enableConsole: false,
    });
    second.appLogger.info({ event: "second.write" }, "second");
    await closeLoggingSystem(second);

    const entries = await readLogEntries(logDir, "app");
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event: "first.write" }),
        expect.objectContaining({ event: "second.write" }),
      ]),
    );
  });

  it("redacts secrets while preserving normal payload fields", function () {
    const sanitized = sanitizeForLogging({
      message: "show this",
      password: "hide this",
      nested: {
        apiKey: "hide-key",
        prompt: "keep the prompt",
      },
      authorization: "Bearer secret-token",
    });

    expect(sanitized).toMatchObject({
      message: "show this",
      password: REDACTED_VALUE,
      nested: {
        apiKey: REDACTED_VALUE,
        prompt: "keep the prompt",
      },
      authorization: REDACTED_VALUE,
    });
  });

  it("logs App Router requests with request IDs, bodies, and error stacks", async function () {
    const system = createLoggingSystem({
      logDir: await makeTempLogDir(),
      nodeEnv: "test",
      enableConsole: false,
    });
    setLoggingSystemForTests(system);
    const handler = withApiLogging<{ chatId: string }>(
      "POST /api/test/[chatId]",
      async function handler(_request, context) {
        const { chatId } = await context.params;
        if (chatId === "fail") {
          throw new Error("route exploded");
        }
        return NextResponse.json({ chatId, requestId: getRequestId() });
      },
    );

    const response = await handler(
      new Request("http://localhost/api/test/ok?mode=happy", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-request-id": "route-request-1",
          "x-user-id": "user-1",
          "x-organization-id": "org-1",
          "user-agent": "vitest",
          "x-forwarded-for": "203.0.113.10, 10.0.0.1",
        },
        body: JSON.stringify({
          message: "hello",
          password: "do-not-log",
        }),
      }),
      { params: Promise.resolve({ chatId: "ok" }) },
    );
    const errorResponse = await handler(
      new Request("http://localhost/api/test/fail", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-request-id": "route-request-2",
        },
        body: JSON.stringify({ message: "boom" }),
      }),
      { params: Promise.resolve({ chatId: "fail" }) },
    );
    await closeLoggingSystem(system);

    expect(response.headers.get("x-request-id")).toBe("route-request-1");
    expect(errorResponse.status).toBe(500);
    expect(errorResponse.headers.get("x-request-id")).toBe("route-request-2");
    const accessEntries = await readLogEntries(system.logDir, "access");
    expect(accessEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: "http.request.completed",
          requestId: "route-request-1",
          method: "POST",
          url: "/api/test/ok",
          query: { mode: "happy" },
          routeParams: { chatId: "ok" },
          body: {
            message: "hello",
            password: REDACTED_VALUE,
          },
          userId: "user-1",
          organizationId: "org-1",
          ip: "203.0.113.10",
          userAgent: "vitest",
          statusCode: 200,
        }),
      ]),
    );
    const errorEntries = await readLogEntries(system.logDir, "error");
    expect(errorEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          requestId: "route-request-2",
          event: "http.request.unhandled_error",
          err: expect.objectContaining({
            stack: expect.stringContaining("route exploded"),
          }),
        }),
      ]),
    );
  });

  it("logs outbound requests and propagates redacted request context", async function () {
    const system = createLoggingSystem({
      logDir: await makeTempLogDir(),
      nodeEnv: "test",
      enableConsole: false,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            ok: true,
            echo: "visible",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }),
    );

    await runWithRequestContext(
      {
        requestId: "outbound-request-1",
        correlationId: "outbound-correlation-1",
        userId: null,
        organizationId: null,
        routeName: "test",
        routeParams: {},
        logger: system.appLogger.child({
          requestId: "outbound-request-1",
          correlationId: "outbound-correlation-1",
        }),
      },
      async () => {
        await fetchJson("https://example.test/api", {
          targetService: "example",
          method: "POST",
          headers: {
            Authorization: "Bearer should-not-log",
            "x-safe": "visible",
          },
          body: {
            message: "visible payload",
            password: "hidden payload",
          },
        });
      },
    );
    await closeLoggingSystem(system);

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      "x-request-id": "outbound-request-1",
      "x-correlation-id": "outbound-correlation-1",
    });
    const appEntries = await readLogEntries(system.logDir, "app");
    expect(appEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: "outbound_http.started",
          requestId: "outbound-request-1",
          outboundRequest: expect.objectContaining({
            targetService: "example",
            method: "POST",
            headers: expect.objectContaining({
              Authorization: REDACTED_VALUE,
              "x-safe": "visible",
            }),
            payload: {
              message: "visible payload",
              password: REDACTED_VALUE,
            },
            retryAttempts: 0,
          }),
        }),
        expect.objectContaining({
          event: "outbound_http.completed",
          requestId: "outbound-request-1",
          outboundRequest: expect.objectContaining({
            statusCode: 200,
            body: {
              ok: true,
              echo: "visible",
            },
          }),
        }),
      ]),
    );
  });

  it("includes request IDs in upload, proposal, and execution business logs", async function () {
    const system = createLoggingSystem({
      logDir: await makeTempLogDir(),
      nodeEnv: "test",
      enableConsole: false,
    });

    await runWithRequestContext(
      {
        requestId: "business-request-1",
        correlationId: "business-request-1",
        userId: null,
        organizationId: null,
        routeName: "test-business",
        routeParams: {},
        logger: system.appLogger.child({
          requestId: "business-request-1",
          correlationId: "business-request-1",
        }),
      },
      async () => {
        const details = await createChat();
        const file = new File([sampleRateSheet], "rates.md", {
          type: "text/markdown",
        });
        await storeChatUpload(details.chat.id, file);
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
      },
    );
    await closeLoggingSystem(system);

    const appEntries = await readLogEntries(system.logDir, "app");
    expect(appEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          requestId: "business-request-1",
          event: "file.stored",
        }),
        expect.objectContaining({
          requestId: "business-request-1",
          event: "proposal.generated",
        }),
        expect.objectContaining({
          requestId: "business-request-1",
          event: "lamasoo.price_capacity_upsert.completed",
        }),
        expect.objectContaining({
          requestId: "business-request-1",
          event: "proposal.execution.persisted",
        }),
      ]),
    );
  });
});

async function makeTempLogDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "agent-logs-"));
  tempDirs.push(dir);
  return dir;
}

async function readLogEntries(
  logDir: string,
  kind: "app" | "access" | "error",
): Promise<Array<Record<string, unknown>>> {
  const text = await readFile(join(logDir, dailyLogFileName(kind)), "utf8");
  return text
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function mockLamasooClients(): void {
  vi.mocked(getCurrentHotel).mockResolvedValue({
    id: 1,
    name: "Aria Hotel",
  });
  vi.mocked(listRoomTypes).mockResolvedValue([{ id: 10, name: "Deluxe Twin" }]);
  vi.mocked(listRatePlans).mockResolvedValue([
    { id: 20, name: "Breakfast", mealType: "BB" },
  ]);
  vi.mocked(listBundles).mockResolvedValue([{ id: 30, name: "Summer" }]);
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
}

async function createPendingProposal(input: {
  payload: LamasooPriceCapacityPayload;
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
  return prisma.actionProposal.create({
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
}

const sampleRateSheet = `
| hotel | title | from | to | currency |
|---|---|---|---|---|
| Aria Hotel | Summer | 2026-08-01 | 2026-08-01 | IRR |

| roomName | ratePlanName | displayPrice |
|---|---|---:|
| Deluxe Twin | BB | 7500000 |
`;
