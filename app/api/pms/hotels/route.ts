import { NextResponse } from "next/server";
import { getServerConfig } from "@/src/server/config";
import { listHotels } from "@/src/server/dummy-pms/client";

export const runtime = "nodejs";

/**
 * List hotels for the frontend selector without invoking the LLM.
 * @returns Hotel list.
 */
export async function GET() {
  try {
    const hotels = await listHotels(getServerConfig());
    return NextResponse.json({ hotels });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error), hotels: [] },
      { status: 400 },
    );
  }
}

/**
 * Convert an unknown error to a safe message.
 * @param error - Unknown error.
 * @returns Error message.
 */
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Hotels could not be loaded.";
}
