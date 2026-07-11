import { NextResponse } from "next/server";
import { z } from "zod";
import { processUserMessage } from "@/src/server/chats/service";
import { routeErrorResponse, withApiLogging } from "@/src/server/logging";

export const runtime = "nodejs";

const sendMessageSchema = z
  .object({
    message: z.string().trim().min(1),
  })
  .strict();

export const POST = withApiLogging<{ chatId: string }>(
  "POST /api/chats/[chatId]/messages",
  async function POST(
    request: Request,
    context: { params: Promise<{ chatId: string }> },
  ) {
    try {
      const { chatId } = await context.params;
      const body = sendMessageSchema.parse(await request.json());
      return NextResponse.json(await processUserMessage(chatId, body.message));
    } catch (error) {
      return routeErrorResponse(error, "Message request failed.", 400);
    }
  },
);
