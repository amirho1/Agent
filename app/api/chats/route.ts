import { NextResponse } from "next/server";
import { z } from "zod";
import { createChat, listChats } from "@/src/server/chats/service";

export const runtime = "nodejs";

const createChatSchema = z
  .object({
    message: z.string().trim().min(1).optional(),
  })
  .strict();

export async function GET() {
  try {
    return NextResponse.json({ chats: await listChats() });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const body = createChatSchema.parse(await request.json().catch(() => ({})));
    return NextResponse.json(await createChat(body.message));
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Request failed.";
}
