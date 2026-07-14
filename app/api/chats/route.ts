import { NextResponse } from "next/server";
import { z } from "zod";
import { createChat, listChats } from "@/src/server/chats/service";
import { routeErrorResponse, withApiLogging } from "@/src/server/logging";

export const runtime = "nodejs";

const createChatSchema = z
  .object({
    message: z.string().trim().min(1).optional(),
  })
  .strict();

export const GET = withApiLogging("GET /api/chats", async function GET() {
  try {
    return NextResponse.json({ chats: await listChats() });
  } catch (error) {
    return routeErrorResponse(error, "Chat list request failed.", 400);
  }
});

export const POST = withApiLogging(
  "POST /api/chats",
  async function POST(request) {
    try {
      const body = createChatSchema.parse(
        await request.json().catch(() => ({})),
      );
      return NextResponse.json(await createChat(body.message));
    } catch (error) {
      return routeErrorResponse(error, "Chat creation request failed.", 400);
    }
  },
);
