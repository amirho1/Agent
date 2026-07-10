"use client";

import type { ReadResultDto } from "@/src/shared/chat-types";

export function PriceResultTable({ result }: { result: ReadResultDto }) {
  return (
    <section className="min-h-0 overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
      <div className="border-b border-slate-800 px-4 py-3">
        <h2 className="text-sm font-semibold text-white">{result.title}</h2>
        <p className="mt-1 text-xs text-slate-400">{result.summary}</p>
      </div>
      <div className="max-h-[58vh] overflow-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="sticky top-0 bg-slate-900 text-xs text-slate-400">
            <tr>
              {result.columns.map((column) => (
                <th key={column} className="px-3 py-2">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, index) => (
              <tr key={index} className="border-t border-slate-800">
                {result.columns.map((column) => (
                  <td key={column} className="px-3 py-2 text-slate-300">
                    {formatValue(row[column])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
