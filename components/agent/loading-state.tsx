"use client";

import { Loader2 } from "lucide-react";

export function LoadingState({ label = "Working" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-400">
      <Loader2 className="size-4 animate-spin" />
      <span>{label}</span>
    </div>
  );
}
