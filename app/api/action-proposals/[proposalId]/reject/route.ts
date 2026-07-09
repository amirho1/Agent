import { NextResponse } from "next/server";
import { rejectProposal } from "@/src/server/price-actions/execution";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ proposalId: string }> },
) {
  try {
    const { proposalId } = await context.params;
    return NextResponse.json(await rejectProposal(proposalId));
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Reject request failed.";
}
