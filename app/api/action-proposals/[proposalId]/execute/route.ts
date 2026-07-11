import { NextResponse } from "next/server";
import { executeConfirmedProposal } from "@/src/server/price-actions/execution";
import { routeErrorResponse, withApiLogging } from "@/src/server/logging";

export const runtime = "nodejs";

export const POST = withApiLogging<{ proposalId: string }>(
  "POST /api/action-proposals/[proposalId]/execute",
  async function POST(
    _request: Request,
    context: { params: Promise<{ proposalId: string }> },
  ) {
    try {
      const { proposalId } = await context.params;
      return NextResponse.json(await executeConfirmedProposal(proposalId));
    } catch (error) {
      return routeErrorResponse(error, "Execution request failed.", 400);
    }
  },
);
