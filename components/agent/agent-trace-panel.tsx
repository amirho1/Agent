"use client";

import { AlertTriangle, CheckCircle2, Circle } from "lucide-react";
import type { AgentStepDto } from "@/src/shared/chat-types";

export function AgentTracePanel({ steps }: { steps: AgentStepDto[] }) {
  return (
    <aside className="hidden h-screen w-80 shrink-0 overflow-y-auto border-r border-slate-800 bg-slate-950 p-4 lg:block">
      <h2 className="text-sm font-semibold text-white">Agent Trace</h2>
      <div className="mt-4 space-y-3">
        {steps.length === 0 ? (
          <p className="text-sm text-slate-500">No trace yet.</p>
        ) : (
          steps.map((step) => (
            <div key={step.id} className="flex gap-3 text-sm">
              <TraceIcon status={step.status} />
              <div className="min-w-0">
                <p className="text-slate-100">{step.label}</p>
                <p className="text-[11px] text-slate-500">
                  {new Date(step.createdAt).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

function TraceIcon({ status }: { status: string }) {
  if (status === "WARNING") {
    return <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" />;
  }

  if (status === "ERROR") {
    return <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-400" />;
  }

  if (status === "COMPLETED") {
    return <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />;
  }

  return <Circle className="mt-0.5 size-4 shrink-0 text-slate-500" />;
}
