"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChatListItem } from "@/src/shared/chat-types";

export function ChatSidebar({
  chats,
  activeChatId,
  onNewChat,
  isLoading,
}: {
  chats: ChatListItem[];
  activeChatId?: string;
  onNewChat: () => void;
  isLoading?: boolean;
}) {
  return (
    <aside className="flex h-screen w-80 shrink-0 flex-col border-r border-slate-800 bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-800 p-4">
        <div>
          <h1 className="text-base font-semibold text-white">Agent</h1>
          <p className="text-xs text-slate-500">Hotel PMS operations</p>
        </div>
        <Button
          type="button"
          size="icon"
          onClick={onNewChat}
          disabled={isLoading}
          aria-label="New chat"
          title="New chat"
        >
          <Plus className="size-4" />
        </Button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="space-y-1">
          {chats.map((chat) => (
            <Link
              key={chat.id}
              href={`/chats/${chat.id}`}
              className={`block rounded-lg border px-3 py-2 text-sm transition ${
                activeChatId === chat.id
                  ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-50"
                  : "border-transparent text-slate-300 hover:border-slate-800 hover:bg-slate-900"
              }`}
            >
              <span className="block truncate">{chat.title}</span>
              <span className="mt-1 block text-[11px] text-slate-500">
                {new Date(chat.updatedAt).toLocaleString()}
              </span>
            </Link>
          ))}
        </div>
      </nav>
    </aside>
  );
}
