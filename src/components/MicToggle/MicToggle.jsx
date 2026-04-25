import useLiveKitStore from "../../store/useLiveKitStore";
import styles from "./MicToggle.module.css";

/**
 * MicToggle — Google Meet-style circular mic button.
 *
 * - Active (mic on):  dark circle, white mic icon
 * - Muted (mic off):  red circle, crossed-out mic icon
 *
 * Reads/writes `isMicOn` in useLiveKitStore.
 * MicBridge inside RoomProvider applies the change to the LiveKit track.
 */
function MicToggle() {
  const isMicOn  = useLiveKitStore((s) => s.isMicOn);
  const setMicOn = useLiveKitStore((s) => s.setMicOn);

  return (
    <button
      className={`${styles.btn} ${isMicOn ? styles.active : styles.muted}`}
      onClick={() => setMicOn(!isMicOn)}
      aria-label={isMicOn ? "Mute microphone" : "Unmute microphone"}
      aria-pressed={isMicOn}
    >
      {isMicOn ? (
        /* Mic on: normal microphone */
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor" />
          <path d="M5 10a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="9" y1="21" x2="15" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ) : (
        /* Mic off: mic with diagonal slash */
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor" />
          <path d="M5 10a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="9" y1="21" x2="15" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          {/* Diagonal slash */}
          <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}

export default MicToggle;
