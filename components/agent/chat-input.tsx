"use client";

import { FormEvent, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileUploader } from "./file-uploader";

export function ChatInput({
  onSend,
  onUpload,
  disabled,
}: {
  onSend: (message: string) => Promise<void> | void;
  onUpload?: (file: File) => Promise<void> | void;
  disabled?: boolean;
}) {
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || disabled) {
      return;
    }

    setMessage("");
    await onSend(trimmed);
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="flex items-end gap-2 border-t border-slate-800 bg-slate-950 p-3"
    >
      {onUpload ? (
        <FileUploader onUpload={onUpload} disabled={disabled} />
      ) : null}
      <textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        rows={1}
        placeholder="Increase room prices by 10% for hotel 1"
        disabled={disabled}
        className="min-h-10 flex-1 resize-none rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-500"
      />
      <Button
        type="submit"
        size="icon-lg"
        disabled={disabled || !message.trim()}
        aria-label="Send"
        title="Send"
      >
        <Send className="size-4" />
      </Button>
    </form>
  );
}
