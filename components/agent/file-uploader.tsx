"use client";

import { Upload } from "lucide-react";

export function FileUploader({
  onUpload,
  disabled,
}: {
  onUpload: (file: File) => Promise<void> | void;
  disabled?: boolean;
}) {
  return (
    <label
      aria-label="Upload file"
      title="Upload file"
      className={`flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-200 transition hover:bg-slate-800 ${
        disabled ? "pointer-events-none opacity-50" : "cursor-pointer"
      }`}
    >
      <Upload className="size-4" />
      <input
        type="file"
        accept=".txt,.md,.markdown,text/plain,text/markdown,text/x-markdown"
        className="hidden"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) {
            void onUpload(file);
          }
        }}
      />
    </label>
  );
}
