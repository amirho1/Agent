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
  const proposalIssues = proposal.validationIssues.filter(
    issue => issue.level === "error" && !issue.rowId,
  );

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
          <Metric label="Items" value={String(proposal.affectedRowsCount)} />
          <Metric label="Hotel" value={formatMetricValue(proposal.hotelId)} />
          <Metric label="Bundle" value={formatMetricValue(proposal.bundleId)} />
          <Metric label="Source" value="Lamasoo" />
        </div>
      </div>

      {proposalIssues.length > 0 ? (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-100">
          {proposalIssues.map(issue => (
            <p key={`${issue.field ?? "proposal"}-${issue.message}`}>
              {issue.field ? `${issue.field}: ` : ""}
              {issue.message}
            </p>
          ))}
        </div>
      ) : null}

      {proposal.assumptions.length > 0 ? (
        <div className="mt-4 space-y-1 text-xs text-slate-400">
          {proposal.assumptions.map(assumption => (
            <p key={assumption}>{assumption}</p>
          ))}
        </div>
      ) : null}

      {proposal.warnings.length > 0 ? (
        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
          {proposal.warnings.map(warning => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}

      <details className="mt-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-300">
        <summary className="cursor-pointer text-slate-100">Planned Lamasoo JSON payload</summary>
        <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap">
          {JSON.stringify(proposal.lamasooPayload, null, 2)}
        </pre>
      </details>

      {isPending ? (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onReject} disabled={isBusy}>
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

function formatMetricValue(value: string | number | undefined): string {
  return value === undefined || value === "" ? "-" : String(value);
}
