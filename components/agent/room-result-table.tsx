"use client";

import type { ReadResultDto } from "@/src/shared/chat-types";

export function RoomResultTable({ result }: { result: ReadResultDto }) {
  return (
    <section className="min-h-0 overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
      <div className="border-b border-slate-800 px-4 py-3">
        <h2 className="text-sm font-semibold text-white">{result.title}</h2>
        <p className="mt-1 text-xs text-slate-400">{result.summary}</p>
      </div>
      {result.rows.length === 0 ? (
        <p className="p-4 text-sm text-slate-500">No matching rooms.</p>
      ) : (
        <div className="max-h-[58vh] overflow-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="sticky top-0 bg-slate-900 text-xs text-slate-400">
              <tr>
                <th className="px-3 py-2">Room ID</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Default Count</th>
                <th className="px-3 py-2">Active</th>
                <th className="px-3 py-2">Lowest Display Price</th>
                <th className="px-3 py-2">Rate Plan</th>
                <th className="px-3 py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, index) => (
                <tr
                  key={`${String(row.roomId ?? index)}-${index}`}
                  className="border-t border-slate-800"
                >
                  <td className="px-3 py-2 text-slate-100">
                    {formatValue(row.roomId)}
                  </td>
                  <td className="px-3 py-2 text-slate-100">
                    {formatValue(row.name)}
                  </td>
                  <td className="px-3 py-2 text-slate-300">
                    {formatValue(row.defaultCount)}
                  </td>
                  <td className="px-3 py-2 text-slate-300">
                    {formatValue(row.isActive)}
                  </td>
                  <td className="px-3 py-2 text-emerald-300">
                    {formatValue(row.lowestDisplayPrice)}
                  </td>
                  <td className="px-3 py-2 text-slate-300">
                    {formatValue(row.ratePlan)}
                  </td>
                  <td className="px-3 py-2 text-slate-300">
                    {formatValue(row.date)}
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

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "number") {
    return new Intl.NumberFormat("en-US").format(value);
  }

  return String(value);
}
