import { NextResponse } from "next/server";
import { rejectProposal } from "@/src/server/price-actions/execution";
import { routeErrorResponse, withApiLogging } from "@/src/server/logging";

export const runtime = "nodejs";

export const POST = withApiLogging<{ proposalId: string }>(
  "POST /api/action-proposals/[proposalId]/reject",
  async function POST(
    _request: Request,
    context: { params: Promise<{ proposalId: string }> },
  ) {
    try {
      const { proposalId } = await context.params;
      return NextResponse.json(await rejectProposal(proposalId));
    } catch (error) {
      return routeErrorResponse(error, "Reject request failed.", 400);
    }
  },
);
