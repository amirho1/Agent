import { NextResponse } from "next/server";
import { getChatDetails } from "@/src/server/chats/service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ chatId: string }> },
) {
  try {
    const { chatId } = await context.params;
    return NextResponse.json(await getChatDetails(chatId));
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 404 });
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Chat request failed.";
}
