"use client";

import type { ActionProposalDto } from "@/src/shared/chat-types";

export function DiffTable({ proposal }: { proposal: ActionProposalDto }) {
  const isRoomDiff = proposal.diffs.some((diff) => diff.entityType === "ROOM");

  return (
    <section className="min-h-0 overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
      <div className="border-b border-slate-800 px-4 py-3">
        <h2 className="text-sm font-semibold text-white">Diff</h2>
      </div>
      {proposal.diffs.length === 0 ? (
        <p className="p-4 text-sm text-slate-500">No changed fields.</p>
      ) : (
        <div className="max-h-[52vh] overflow-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="sticky top-0 bg-slate-900 text-xs text-slate-400">
              {isRoomDiff ? <RoomHeader /> : <PriceHeader />}
            </thead>
            <tbody>
              {proposal.diffs.map((diff) => (
                <DiffRow
                  key={`${diff.rowId}-${diff.field}-${diff.action ?? "update"}`}
                  diff={diff}
                  isRoomDiff={isRoomDiff}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RoomHeader() {
  return (
    <tr>
      <th className="px-3 py-2">Action</th>
      <th className="px-3 py-2">Room ID</th>
      <th className="px-3 py-2">Field</th>
      <th className="px-3 py-2">Old Value</th>
      <th className="px-3 py-2">New Value</th>
    </tr>
  );
}

function PriceHeader() {
  return (
    <tr>
      <th className="px-3 py-2">Room</th>
      <th className="px-3 py-2">Date</th>
      <th className="px-3 py-2">Field</th>
      <th className="px-3 py-2">Old Value</th>
      <th className="px-3 py-2">New Value</th>
    </tr>
  );
}

function DiffRow({
  diff,
  isRoomDiff,
}: {
  diff: ActionProposalDto["diffs"][number];
  isRoomDiff: boolean;
}) {
  if (isRoomDiff) {
    return (
      <tr className="border-t border-slate-800">
        <td className="px-3 py-2 text-slate-100">{diff.action ?? "UPDATE"}</td>
        <td className="px-3 py-2 text-slate-300">{diff.rowId}</td>
        <td className="px-3 py-2 text-slate-300">{diff.field}</td>
        <td className="px-3 py-2 text-slate-500">
          {formatValue(diff.oldValue)}
        </td>
        <td className="px-3 py-2 font-medium text-emerald-300">
          {formatValue(diff.newValue)}
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-slate-800">
      <td className="px-3 py-2 text-slate-100">
        {diff.roomName ?? diff.roomTypeProviderId}
      </td>
      <td className="px-3 py-2 text-slate-300">{diff.date}</td>
      <td className="px-3 py-2 text-slate-300">{diff.field}</td>
      <td className="px-3 py-2 text-slate-500">
        {formatValue(diff.oldValue)}
      </td>
      <td className="px-3 py-2 font-medium text-emerald-300">
        {formatValue(diff.newValue)}
      </td>
    </tr>
  );
}

function formatValue(value: string | number | boolean | null): string {
  if (value === null) {
    return "-";
  }

  if (typeof value === "number") {
    return new Intl.NumberFormat("en-US").format(value);
  }

  return String(value);
}
