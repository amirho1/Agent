"use client";

import { Button } from "@/components/ui/button";
import type { ActionProposalDto } from "@/src/shared/chat-types";

export function RejectActionModal({
  proposal,
  onCancel,
  onReject,
  isBusy,
}: {
  proposal: ActionProposalDto;
  onCancel: () => void;
  onReject: () => void;
  isBusy?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
      <div className="w-full max-w-lg rounded-lg border border-slate-800 bg-slate-950 p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-white">Reject Proposal</h2>
        <p className="mt-2 text-sm text-slate-300">
          {proposal.affectedRowsCount} PMS rows will remain unchanged.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isBusy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onReject}
            disabled={isBusy}
          >
            Reject Proposal
          </Button>
        </div>
      </div>
    </div>
  );
}
