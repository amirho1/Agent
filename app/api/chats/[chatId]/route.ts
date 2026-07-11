import { NextResponse } from "next/server";
import { getChatDetails } from "@/src/server/chats/service";
import { routeErrorResponse, withApiLogging } from "@/src/server/logging";

export const runtime = "nodejs";

export const GET = withApiLogging<{ chatId: string }>(
  "GET /api/chats/[chatId]",
  async function GET(
    _request: Request,
    context: { params: Promise<{ chatId: string }> },
  ) {
    try {
      const { chatId } = await context.params;
      return NextResponse.json(await getChatDetails(chatId));
    } catch (error) {
      return routeErrorResponse(error, "Chat request failed.", 404);
    }
  },
);
