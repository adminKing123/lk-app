import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useLiveKitStore from "../store/useLiveKitStore";
import styles from "./StartPage.module.css";

/**
 * StartPage — /
 *
 * Google Meet-style pre-call screen.
 * Lets the user enter their name, choose Video or Voice call type,
 * then fetches a token and navigates to /conversation.
 */
function StartPage() {
  const navigate        = useNavigate();
  const connectionState = useLiveKitStore((s) => s.connectionState);
  const connectionError = useLiveKitStore((s) => s.connectionError);
  const connect         = useLiveKitStore((s) => s.connect);

  /** User's display name — empty means auto-generate */
  const [nameInput, setNameInput] = useState("");
  /** 'video' | 'voice' — determines whether the LiveAvatar session is used */
  const [callType, setCallType]   = useState("video");

  const isConnecting = connectionState === "connecting";

  /* Navigate to the conversation screen as soon as the room is ready */
  useEffect(() => {
    if (connectionState === "connected") {
      navigate("/conversation", { replace: true });
    }
  }, [connectionState, navigate]);

  const handleJoin = (e) => {
    e.preventDefault();
    connect({ callType, participantName: nameInput });
  };

  return (
    <div className={styles.page}>
      <form className={styles.joinPanel} onSubmit={handleJoin}>
        <h1 className={styles.title}>Ready to start?</h1>
        <p className={styles.subtitle}>
          Your AI assistant is ready to help.
        </p>

        {/* Name input */}
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor="participant-name">
            Your name
          </label>
          <input
            id="participant-name"
            type="text"
            className={styles.nameInput}
            placeholder="Leave blank to stay anonymous"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            maxLength={40}
            autoComplete="name"
            spellCheck={false}
          />
        </div>

        {/* Call type selector — card-style, visually distinct from the CTA */}
        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>How would you like to connect?</span>
          <div className={styles.callTypeGroup} role="group" aria-label="Choose call type">
            <button
              type="button"
              className={`${styles.callTypeCard} ${callType === "video" ? styles.callTypeCardActive : ""}`}
              onClick={() => setCallType("video")}
              aria-pressed={callType === "video"}
            >
              {/* Camera icon */}
              <svg className={styles.callTypeIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <rect x="2" y="6" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.75" />
                <path d="M16 10l6-3v10l-6-3V10z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
              </svg>
              <span className={styles.callTypeTitle}>Video Call</span>
              <span className={styles.callTypeDesc}>Visual appearance</span>
            </button>
            <button
              type="button"
              className={`${styles.callTypeCard} ${callType === "voice" ? styles.callTypeCardActive : ""}`}
              onClick={() => setCallType("voice")}
              aria-pressed={callType === "voice"}
            >
              {/* Mic icon */}
              <svg className={styles.callTypeIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <rect x="9" y="2" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.75" />
                <path d="M5 11a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                <line x1="12" y1="18" x2="12" y2="22" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                <line x1="9" y1="22" x2="15" y2="22" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
              <span className={styles.callTypeTitle}>Voice Call</span>
              <span className={styles.callTypeDesc}>Audio only</span>
            </button>
          </div>
        </div>

        {connectionError && (
          <div className={styles.error} role="alert">
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM9 9a1 1 0 0 0 0 2v3a1 1 0 0 0 2 0v-3a1 1 0 0 0-1-1H9z" clipRule="evenodd" />
            </svg>
            {connectionError}
          </div>
        )}

        {/* Primary CTA — visually dominant, full-width */}
        <button
          type="submit"
          className={styles.joinBtn}
          disabled={isConnecting}
          aria-busy={isConnecting}
        >
          {isConnecting ? (
            <>
              <span className={styles.spinner} aria-hidden="true" />
              Connecting…
            </>
          ) : (
            <>
              Start conversation
              {/* Arrow icon */}
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10z" clipRule="evenodd" />
              </svg>
            </>
          )}
        </button>

        <p className={styles.hint}>
          <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M10 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM10 2a8 8 0 1 0 0 16A8 8 0 0 0 10 2z"
              stroke="currentColor" strokeWidth="1.25" />
          </svg>
          Microphone access will be requested
        </p>
      </form>
    </div>
  );
}

export default StartPage;
