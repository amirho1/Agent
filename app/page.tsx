"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot } from "lucide-react";
import { ChatInput } from "@/components/agent/chat-input";
import { ChatSidebar } from "@/components/agent/chat-sidebar";
import { ErrorState } from "@/components/agent/error-state";
import { LoadingState } from "@/components/agent/loading-state";
import type { ChatDetailsDto, ChatListItem } from "@/src/shared/chat-types";

export default function Home() {
  const router = useRouter();
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadChats = useCallback(async () => {
    try {
      const response = await fetch("/api/chats");
      const data = (await response.json()) as {
        chats?: ChatListItem[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Could not load chats.");
      }
      setChats(data.chats ?? []);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadChats();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadChats]);

  async function handleNewChat() {
    setIsLoading(true);
    setError(null);
    try {
      const details = await postJson<ChatDetailsDto>("/api/chats", {});
      router.push(`/chats/${details.chat.id}`);
    } catch (newChatError) {
      setError(getErrorMessage(newChatError));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSend(message: string) {
    setIsLoading(true);
    setError(null);
    try {
      const details = await postJson<ChatDetailsDto>("/api/chats", {
        message,
      });
      router.push(`/chats/${details.chat.id}`);
    } catch (sendError) {
      setError(getErrorMessage(sendError));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpload(file: File) {
    setIsLoading(true);
    setError(null);
    try {
      const details = await postJson<ChatDetailsDto>("/api/chats", {});
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`/api/chats/${details.chat.id}/uploads`, {
        method: "POST",
        body: formData,
      });
      const uploadDetails = (await response.json()) as ChatDetailsDto & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(uploadDetails.error ?? "Upload failed.");
      }
      router.push(`/chats/${uploadDetails.chat.id}`);
    } catch (uploadError) {
      setError(getErrorMessage(uploadError));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen bg-[#020617] text-slate-200">
      <ChatSidebar
        chats={chats}
        onNewChat={() => void handleNewChat()}
        isLoading={isLoading}
      />
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-2xl text-center">
            <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-lg bg-cyan-500 text-slate-950">
              <Bot className="size-6" />
            </div>
            <h1 className="text-2xl font-semibold text-white">
              Hotel PMS Action Agent
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Price updates are prepared for review before any PMS write.
            </p>
            <div className="mt-6">
              {error ? <ErrorState message={error} /> : null}
              {isLoading ? (
                <div className="mt-4 flex justify-center">
                  <LoadingState />
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <ChatInput
          onSend={handleSend}
          onUpload={handleUpload}
          disabled={isLoading}
        />
      </section>
    </main>
  );
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "Request failed.");
  }
  return data;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}
