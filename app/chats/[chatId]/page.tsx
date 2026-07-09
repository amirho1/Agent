"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChatInput } from "@/components/agent/chat-input";
import { ChatSidebar } from "@/components/agent/chat-sidebar";
import { AgentTracePanel } from "@/components/agent/agent-trace-panel";
import { ActionSummaryCard } from "@/components/agent/action-summary-card";
import { DiffTable } from "@/components/agent/diff-table";
import { ConfirmActionModal } from "@/components/agent/confirm-action-modal";
import { RejectActionModal } from "@/components/agent/reject-action-modal";
import { ErrorState } from "@/components/agent/error-state";
import { LoadingState } from "@/components/agent/loading-state";
import type {
  ActionProposalDto,
  ChatDetailsDto,
  ChatListItem,
} from "@/src/shared/chat-types";

export default function ChatDetailPage() {
  const params = useParams<{ chatId: string }>();
  const router = useRouter();
  const chatId = params.chatId;
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [details, setDetails] = useState<ChatDetailsDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [modal, setModal] = useState<"confirm" | "reject" | null>(null);

  const latestProposal = useMemo(
    () => details?.actionProposals[0],
    [details?.actionProposals],
  );

  const loadChats = useCallback(async () => {
    const chatList = await getJson<{ chats: ChatListItem[] }>("/api/chats");
    setChats(chatList.chats);
  }, []);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [chatList, chatDetails] = await Promise.all([
        getJson<{ chats: ChatListItem[] }>("/api/chats"),
        getJson<ChatDetailsDto>(`/api/chats/${chatId}`),
      ]);
      setChats(chatList.chats);
      setDetails(chatDetails);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAll();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAll]);

  async function handleNewChat() {
    setIsLoading(true);
    setError(null);
    try {
      const created = await postJson<ChatDetailsDto>("/api/chats", {});
      router.push(`/chats/${created.chat.id}`);
    } catch (newChatError) {
      setError(getErrorMessage(newChatError));
      setIsLoading(false);
    }
  }

  async function handleSend(message: string) {
    setIsLoading(true);
    setError(null);
    try {
      const nextDetails = await postJson<ChatDetailsDto>(
        `/api/chats/${chatId}/messages`,
        { message },
      );
      setDetails(nextDetails);
      await loadChats();
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
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`/api/chats/${chatId}/uploads`, {
        method: "POST",
        body: formData,
      });
      const nextDetails = (await response.json()) as ChatDetailsDto & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(nextDetails.error ?? "Upload failed.");
      }
      setDetails(nextDetails);
      await loadChats();
    } catch (uploadError) {
      setError(getErrorMessage(uploadError));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleExecute(proposal: ActionProposalDto) {
    setIsLoading(true);
    setError(null);
    try {
      await postJson(`/api/action-proposals/${proposal.id}/execute`, {});
      setModal(null);
      await loadAll();
    } catch (executeError) {
      setError(getErrorMessage(executeError));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleReject(proposal: ActionProposalDto) {
    setIsLoading(true);
    setError(null);
    try {
      await postJson(`/api/action-proposals/${proposal.id}/reject`, {});
      setModal(null);
      await loadAll();
    } catch (rejectError) {
      setError(getErrorMessage(rejectError));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen bg-[#020617] text-slate-200">
      <ChatSidebar
        chats={chats}
        activeChatId={chatId}
        onNewChat={() => void handleNewChat()}
        isLoading={isLoading}
      />
      <AgentTracePanel steps={details?.agentSteps ?? []} />
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {error ? <ErrorState message={error} /> : null}
          {isLoading && !details ? (
            <div className="p-4">
              <LoadingState />
            </div>
          ) : null}
          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(560px,1.2fr)]">
            <section className="space-y-3">
              <h1 className="text-lg font-semibold text-white">
                {details?.chat.title ?? "Chat"}
              </h1>
              <div className="space-y-2">
                {details?.messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
              </div>
            </section>
            <section className="min-w-0 space-y-4">
              {latestProposal ? (
                <>
                  <ActionSummaryCard
                    proposal={latestProposal}
                    onConfirm={() => setModal("confirm")}
                    onReject={() => setModal("reject")}
                    isBusy={isLoading}
                  />
                  <DiffTable proposal={latestProposal} />
                  {latestProposal.executions[0] ? (
                    <ExecutionState proposal={latestProposal} />
                  ) : null}
                </>
              ) : (
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 text-sm text-slate-500">
                  No proposal yet.
                </div>
              )}
            </section>
          </div>
        </div>
        <ChatInput
          onSend={handleSend}
          onUpload={handleUpload}
          disabled={isLoading}
        />
      </section>

      {modal === "confirm" && latestProposal ? (
        <ConfirmActionModal
          proposal={latestProposal}
          onCancel={() => setModal(null)}
          onConfirm={() => void handleExecute(latestProposal)}
          isBusy={isLoading}
        />
      ) : null}

      {modal === "reject" && latestProposal ? (
        <RejectActionModal
          proposal={latestProposal}
          onCancel={() => setModal(null)}
          onReject={() => void handleReject(latestProposal)}
          isBusy={isLoading}
        />
      ) : null}
    </main>
  );
}

function MessageBubble({
  message,
}: {
  message: NonNullable<ChatDetailsDto["messages"]>[number];
}) {
  const isUser = message.role === "user";

  return (
    <div
      className={`rounded-lg border p-3 text-sm ${
        isUser
          ? "ml-auto max-w-[86%] border-cyan-500/30 bg-cyan-500/10 text-cyan-50"
          : "border-slate-800 bg-slate-950 text-slate-200"
      }`}
    >
      <p className="whitespace-pre-wrap">{message.content}</p>
      <p className="mt-2 text-[11px] text-slate-500">
        {new Date(message.createdAt).toLocaleTimeString()}
      </p>
    </div>
  );
}

function ExecutionState({ proposal }: { proposal: ActionProposalDto }) {
  const execution = proposal.executions[0];

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950 p-4 text-sm">
      <h2 className="font-semibold text-white">Execution</h2>
      <p className="mt-1 text-slate-400">{execution.status}</p>
      {execution.error ? (
        <p className="mt-2 text-rose-300">{execution.error}</p>
      ) : null}
    </section>
  );
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "Request failed.");
  }
  return data;
}

async function postJson<T = unknown>(url: string, body: unknown): Promise<T> {
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
