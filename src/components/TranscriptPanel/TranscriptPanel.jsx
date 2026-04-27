import { useEffect, useRef, useState } from "react";
import useLiveKitStore from "../../store/useLiveKitStore";
import styles from "./TranscriptPanel.module.css";

/**
 * TranscriptPanel — Google Meet-style right-side chat panel.
 *
 * Always mounted; open/close is driven by CSS `width` + `opacity` transition
 * (no mount/unmount) so both directions animate smoothly.
 *
 * Includes a text input at the bottom so the user can type messages that are
 * sent to the agent via the LiveKit `lk.chat` topic.
 *
 * @param {{ isOpen: boolean, onClose: () => void }} props
 */
function TranscriptPanel({ isOpen, onClose }) {
  const transcripts      = useLiveKitStore((s) => s.transcripts);
  const upsertTranscript = useLiveKitStore((s) => s.upsertTranscript);
  const sendText         = useLiveKitStore((s) => s.sendText);

  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);
  const [draft, setDraft] = useState("");

  /* Auto-scroll to newest message */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts]);

  /** Send the drafted message to the agent via LiveKit lk.chat topic. */
  const handleSend = () => {
    const text = draft.trim();
    if (!text || !sendText) return;

    // Optimistically display the message immediately in the chat panel
    upsertTranscript({
      id:      `user-text-${Date.now()}`,
      sender:  "user",
      text,
      isFinal: true,
    });

    setDraft("");
    inputRef.current?.focus();

    // Fire-and-forget — RoomProvider's TextSendBridge handles the LiveKit call
    sendText(text).catch((err) => {
      console.error("[TranscriptPanel] sendText failed:", err);
    });
  };

  /** Allow pressing Enter (without Shift) to submit the message. */
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <aside className={styles.panel} data-open={isOpen} aria-hidden={!isOpen}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <h2 className={styles.title}>In-call messages</h2>
        <button
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Close messages panel"
        >
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* ── Message list ── */}
      <div className={styles.messages}>
        {transcripts.length === 0 ? (
          <div className={styles.emptyState}>
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            <p>Messages will appear here as you speak or type below</p>
          </div>
        ) : (
          transcripts.map((msg) => (
            <div
              key={msg.id}
              className={`${styles.message} ${msg.sender === "agent" ? styles.agent : styles.user}`}
            >
              <div className={styles.avatar}>
                {msg.sender === "agent" ? "AI" : "You"}
              </div>
              <div className={styles.bubble}>
                <p className={`${styles.text} ${msg.isFinal ? "" : styles.partial}`}>
                  {msg.text}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Text input ── */}
      <div className={styles.inputArea}>
        <textarea
          ref={inputRef}
          className={styles.chatInput}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          rows={1}
          aria-label="Type a message to send to the AI"
          disabled={!sendText}
        />
        <button
          className={styles.sendBtn}
          onClick={handleSend}
          disabled={!draft.trim() || !sendText}
          aria-label="Send message"
        >
          {/* Paper-plane send icon */}
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M22 2 11 13M22 2 15 22l-4-9-9-4 20-7z"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </aside>
  );
}

export default TranscriptPanel;
