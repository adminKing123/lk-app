import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useLiveKitStore from "../store/useLiveKitStore";
import styles from "./StartPage.module.css";

/**
 * StartPage — /
 *
 * Google Meet-style pre-call screen.
 * Single "Join now" call-to-action that fetches a LiveKit token and
 * navigates to /conversation once the room is ready.
 */
function StartPage() {
  const navigate        = useNavigate();
  const connectionState = useLiveKitStore((s) => s.connectionState);
  const connectionError = useLiveKitStore((s) => s.connectionError);
  const connect         = useLiveKitStore((s) => s.connect);

  const isConnecting = connectionState === "connecting";

  /* Navigate to the conversation screen as soon as the room is ready */
  useEffect(() => {
    if (connectionState === "connected") {
      navigate("/conversation", { replace: true });
    }
  }, [connectionState, navigate]);

  return (
    <div className={styles.page}>
      {/* Left: preview / branding */}
      <div className={styles.preview}>
        <div className={styles.previewVideo}>
          {/* Avatar silhouette */}
          <div className={styles.silhouette} aria-hidden="true">
            <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="40" cy="28" r="18" stroke="currentColor" strokeWidth="2" />
              <path d="M8 72c0-17.7 14.3-32 32-32s32 14.3 32 32"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div className={styles.previewLabel}>AI Assistant</div>
        </div>
      </div>

      {/* Right: join panel */}
      <div className={styles.joinPanel}>
        <h1 className={styles.title}>Ready to start?</h1>
        <p className={styles.subtitle}>
          Your AI assistant is ready to help.
        </p>

        {connectionError && (
          <div className={styles.error} role="alert">
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM9 9a1 1 0 0 0 0 2v3a1 1 0 0 0 2 0v-3a1 1 0 0 0-1-1H9z" clipRule="evenodd" />
            </svg>
            {connectionError}
          </div>
        )}

        <button
          className={styles.joinBtn}
          onClick={() => connect()}
          disabled={isConnecting}
          aria-busy={isConnecting}
        >
          {isConnecting ? (
            <>
              <span className={styles.spinner} aria-hidden="true" />
              Connecting…
            </>
          ) : (
            "Join now"
          )}
        </button>

        <p className={styles.hint}>
          <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M10 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM10 2a8 8 0 1 0 0 16A8 8 0 0 0 10 2z"
              stroke="currentColor" strokeWidth="1.25" />
          </svg>
          Microphone access will be requested
        </p>
      </div>
    </div>
  );
}

export default StartPage;
