import { useEffect, useRef } from "react";
import useLiveKitStore from "../../store/useLiveKitStore";
import styles from "./TranscriptPanel.module.css";

/**
 * TranscriptPanel — Google Meet-style right-side chat panel.
 *
 * Always mounted; open/close is driven by CSS `transform` transition
 * (no mount/unmount) so both directions animate smoothly.
 *
 * @param {{ isOpen: boolean, onClose: () => void }} props
 */
function TranscriptPanel({ isOpen, onClose }) {
  const transcripts = useLiveKitStore((s) => s.transcripts);
  const bottomRef   = useRef(null);

  /* Auto-scroll to newest message */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts]);

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
            <p>Messages will appear here as you speak</p>
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
    </aside>
  );
}

export default TranscriptPanel;
