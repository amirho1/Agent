import { NextResponse } from "next/server";
import { z } from "zod";
import { processUserMessage } from "@/src/server/chats/service";

export const runtime = "nodejs";

const sendMessageSchema = z
  .object({
    message: z.string().trim().min(1),
  })
  .strict();

export async function POST(
  request: Request,
  context: { params: Promise<{ chatId: string }> },
) {
  try {
    const { chatId } = await context.params;
    const body = sendMessageSchema.parse(await request.json());
    return NextResponse.json(await processUserMessage(chatId, body.message));
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Message request failed.";
}
