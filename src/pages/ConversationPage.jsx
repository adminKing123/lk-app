import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useVoiceAssistant, BarVisualizer } from "@livekit/components-react";
import useLiveKitStore from "../store/useLiveKitStore";

import RoomProvider    from "../components/room/RoomProvider";
import AvatarVideo     from "../components/AvatarVideo/AvatarVideo";
import MicToggle       from "../components/MicToggle/MicToggle";
import TranscriptPanel from "../components/TranscriptPanel/TranscriptPanel";

import styles from "./ConversationPage.module.css";

/** Format elapsed seconds as MM:SS */
function formatTime(secs) {
  const m = String(Math.floor(secs / 60)).padStart(2, "0");
  const s = String(secs % 60).padStart(2, "0");
  return `${m}:${s}`;
}

/**
 * VoicePlaceholder — shown in place of AvatarVideo when callType === 'voice'.
 *
 * Uses the LiveKit useVoiceAssistant() hook to obtain the agent's live audio
 * track and current state, then feeds them into BarVisualizer for real-time
 * animated feedback.  Must render inside <LiveKitRoom> (i.e. inside RoomProvider).
 */
function VoicePlaceholder() {
  const { state, audioTrack } = useVoiceAssistant();

  return (
    <div className={styles.voicePlaceholder}>
      {/*
        BarVisualizer — real-time audio waveform from the agent's microphone track.
        `state` drives automatic transitions between speaking / listening / idle animations.
        `trackRef` wires up the live RemoteAudioTrack published by the agent.
      */}
      <BarVisualizer
        state={state}
        trackRef={audioTrack}
        barCount={11}
        className={styles.barVisualizer}
        options={{ maxHeight: 60, minHeight: 2 }}
      />
    </div>
  );
}

/**
 * ConversationPage — /conversation
 *
 * Google Meet-style layout:
 *   - Full-screen dark background
 *   - Avatar video fills the left / full area
 *   - Transparent top overlay: AI name + agent state (left), call timer (right)
 *   - Right side panel: transcript messages (slides in when toggled)
 *   - Bottom toolbar (floating pill): Mic | End Call | Messages
 *
 * Guards: redirects to "/" if session is idle or errored.
 */
function ConversationPage() {
  const navigate        = useNavigate();
  const connectionState = useLiveKitStore((s) => s.connectionState);
  const agentState      = useLiveKitStore((s) => s.agentState);
  const callType        = useLiveKitStore((s) => s.callType);
  const disconnect      = useLiveKitStore((s) => s.disconnect);

  const [showTranscript, setShowTranscript] = useState(false);
  const [elapsed, setElapsed]               = useState(0);
  const timerRef = useRef(null);

  /* Start call timer on mount */
  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed((t) => t + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  /* Redirect to start screen if session drops */
  useEffect(() => {
    if (connectionState === "idle" || connectionState === "error") {
      navigate("/", { replace: true });
    }
  }, [connectionState, navigate]);

  const handleEnd = () => {
    disconnect();
    navigate("/", { replace: true });
  };

  /* Human-readable agent state label shown in the top bar */
  const stateLabel = {
    connecting:   "Connecting…",
    initializing: "Starting up…",
    listening:    "Listening",
    thinking:     "Thinking…",
    speaking:     "Speaking",
    idle:         "Ready",
  }[agentState] ?? agentState;

  return (
    /*
      RoomProvider renders <LiveKitRoom> and mounts RoomBridge + MicBridge.
      AvatarVideo and TranscriptPanel must live inside it.
    */
    <RoomProvider>
      <div className={styles.page}>

        {/* ── Main column: header + content + footer ── */}
        <div className={styles.mainColumn}>

          {/* Header */}
          <header className={styles.topBar}>
            <div className={styles.topLeft}>
              <div className={`${styles.stateDot} ${styles[`dot_${agentState}`] ?? ""}`} aria-hidden="true" />
              <span className={styles.participantName}>AI Assistant</span>
              <span className={styles.stateLabel}>{stateLabel}</span>
            </div>
            <div className={styles.topRight}>
              <span className={styles.timer}>{formatTime(elapsed)}</span>
            </div>
          </header>

          {/* Content: video or voice */}
          <div className={styles.contentArea}>
            <div className={styles.videoArea}>
              {callType === "video" ? (
                <AvatarVideo />
              ) : (
                <VoicePlaceholder />
              )}
            </div>
          </div>

          {/* Footer toolbar */}
          <footer className={styles.toolbar}>
          {/* Mic toggle */}
          <MicToggle />

          {/* End call — prominent red pill */}
          <button
            className={styles.endCallBtn}
            onClick={handleEnd}
            aria-label="End call"
          >
            {/* Phone hang-up icon */}
            <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" />
            </svg>
            End call
          </button>

          {/* Messages toggle */}
          <button
            className={`${styles.toolbarBtn} ${showTranscript ? styles.toolbarBtnActive : ""}`}
            onClick={() => setShowTranscript((v) => !v)}
            aria-label="Toggle messages"
            aria-pressed={showTranscript}
          >
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          </button>
          </footer>

        </div>{/* end .mainColumn */}

        {/* ── Transcript panel — full-height sibling on the right ── */}
        <TranscriptPanel
          isOpen={showTranscript}
          onClose={() => setShowTranscript(false)}
        />

      </div>
    </RoomProvider>
  );
}

export default ConversationPage;
