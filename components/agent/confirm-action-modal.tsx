"use client";

import { Button } from "@/components/ui/button";
import type { ActionProposalDto } from "@/src/shared/chat-types";

export function ConfirmActionModal({
  proposal,
  onCancel,
  onConfirm,
  isBusy,
}: {
  proposal: ActionProposalDto;
  onCancel: () => void;
  onConfirm: () => void;
  isBusy?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
      <div className="w-full max-w-lg rounded-lg border border-slate-800 bg-slate-950 p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-white">Confirm PMS Update</h2>
        <p className="mt-2 text-sm text-slate-300">
          This will update {proposal.affectedRowsCount} PMS rows for hotel{" "}
          {proposal.hotelId}.
        </p>
        <p className="mt-2 text-sm text-slate-500">
          The server will re-check current PMS values before sending the update.
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
            onClick={onConfirm}
            disabled={isBusy}
            className="bg-emerald-500 text-slate-950 hover:bg-emerald-400"
          >
            Confirm Update
          </Button>
        </div>
      </div>
    </div>
  );
}
