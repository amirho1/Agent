"use client";

import type { ActionProposalDto } from "@/src/shared/chat-types";

export function DiffTable({ proposal }: { proposal: ActionProposalDto }) {
  return (
    <section className="min-h-0 overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
      <div className="border-b border-slate-800 px-4 py-3">
        <h2 className="text-sm font-semibold text-white">Lamasoo Diff</h2>
      </div>
      {proposal.diffs.length === 0 ? (
        <p className="p-4 text-sm text-slate-500">No parsed price fields.</p>
      ) : (
        <div className="max-h-[52vh] overflow-auto">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="sticky top-0 bg-slate-900 text-xs text-slate-400">
              <tr>
                <th className="px-3 py-2">Hotel</th>
                <th className="px-3 py-2">Room</th>
                <th className="px-3 py-2">Rate Plan</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Price Type</th>
                <th className="px-3 py-2">Old Price</th>
                <th className="px-3 py-2">New Price</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Issues</th>
              </tr>
            </thead>
            <tbody>
              {proposal.diffs.map((diff) => (
                <tr
                  key={`${diff.rowId}-${diff.field}`}
                  className="border-t border-slate-800"
                >
                  <td className="px-3 py-2 text-slate-100">
                    <div>{formatValue(diff.hotelName ?? null)}</div>
                    <div className="text-xs text-slate-500">
                      {formatValue(diff.hotelId ?? null)}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-100">
                    <div>{formatValue(diff.roomName ?? null)}</div>
                    <div className="text-xs text-slate-500">
                      {formatValue(diff.roomTypeProviderId ?? null)}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-100">
                    <div>{formatValue(diff.ratePlanName ?? null)}</div>
                    <div className="text-xs text-slate-500">
                      {formatValue(diff.ratePlanId ?? null)}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-300">
                    {formatValue(diff.date ?? null)}
                  </td>
                  <td className="px-3 py-2 text-slate-300">{diff.field}</td>
                  <td className="px-3 py-2 text-slate-500">
                    {formatValue(diff.oldValue)}
                  </td>
                  <td className="px-3 py-2 font-medium text-emerald-300">
                    {formatValue(diff.newValue)}
                  </td>
                  <td className="px-3 py-2 text-slate-300">
                    {diff.status ?? "-"}
                  </td>
                  <td className="max-w-[280px] px-3 py-2 text-xs text-amber-100">
                    {diff.issues?.map((issue) => issue.message).join(" ") ??
                      "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function formatValue(
  value: string | number | boolean | null | undefined,
): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "number") {
    return new Intl.NumberFormat("en-US").format(value);
  }

  return String(value);
}
