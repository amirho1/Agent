"use client";

import { useState } from "react";
import { ChatLanding } from "./components/chat-landing";
import { ActionReview } from "./components/action-review";
import { ConfirmationModal, SuccessState } from "./components/modals";

export default function Home() {
  const [view, setView] = useState<"chat" | "review">("chat");
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  return (
    <>
      {view === "chat" && (
        <ChatLanding onSubmit={(msg) => setView("review")} />
      )}
      
      {view === "review" && (
        <ActionReview 
          onConfirm={() => setShowConfirm(true)} 
          onCancel={() => setView("chat")} 
        />
      )}

      {showConfirm && (
        <ConfirmationModal 
          onConfirm={() => {
            setShowConfirm(false);
            setShowSuccess(true);
          }}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      {showSuccess && (
        <SuccessState onDone={() => {
          setShowSuccess(false);
          setView("chat");
        }} />
      )}
    </>
  );
}
