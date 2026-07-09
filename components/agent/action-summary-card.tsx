"use client";

import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ActionProposalDto } from "@/src/shared/chat-types";

export function ActionSummaryCard({
  proposal,
  onConfirm,
  onReject,
  isBusy,
}: {
  proposal: ActionProposalDto;
  onConfirm: () => void;
  onReject: () => void;
  isBusy?: boolean;
}) {
  const isPending = proposal.status === "PENDING";

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="mb-2 inline-flex rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-200">
            {proposal.status}
          </div>
          <h2 className="text-lg font-semibold text-white">{proposal.title}</h2>
          <p className="mt-1 text-sm text-slate-400">{proposal.summary}</p>
        </div>
        <div className="grid grid-cols-2 gap-4 text-right text-sm">
          <Metric label="Rows" value={String(proposal.affectedRowsCount)} />
          <Metric label="Source" value="dummy-PMS" />
        </div>
      </div>

      {proposal.assumptions.length > 0 ? (
        <div className="mt-4 space-y-1 text-xs text-slate-400">
          {proposal.assumptions.map((assumption) => (
            <p key={assumption}>{assumption}</p>
          ))}
        </div>
      ) : null}

      {proposal.warnings.length > 0 ? (
        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
          {proposal.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}

      {isPending ? (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onReject}
            disabled={isBusy}
          >
            <X className="size-4" />
            Reject
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isBusy || proposal.affectedRowsCount === 0}
            className="bg-emerald-500 text-slate-950 hover:bg-emerald-400"
          >
            <Check className="size-4" />
            Confirm
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-slate-500">{label}</div>
      <div className="text-sm font-medium text-slate-100">{value}</div>
    </div>
  );
}
