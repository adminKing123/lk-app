import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useVoiceAssistant, BarVisualizer } from "@livekit/components-react";
import gsap from "gsap";
import useLiveKitStore from "../store/useLiveKitStore";

import RoomProvider    from "../components/room/RoomProvider";
import AvatarVideo     from "../components/AvatarVideo/AvatarVideo";
import MicToggle       from "../components/MicToggle/MicToggle";
import TranscriptPanel from "../components/TranscriptPanel/TranscriptPanel";
import WidgetPanel, { WIDGET_REGISTRY, TabIcon } from "../components/WidgetPanel/WidgetPanel";

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
  const widgets         = useLiveKitStore((s) => s.widgets);
  const clearWidget     = useLiveKitStore((s) => s.clearWidget);

  const [showTranscript, setShowTranscript] = useState(false);
  const [elapsed, setElapsed]               = useState(0);
  const [pipMinimized, setPipMinimized]     = useState(false);
  const timerRef    = useRef(null);
  const pipRef      = useRef(null);
  const pipThumbRef = useRef(null);

  /* ── Widget tab state — managed here so tabs render inside the header ── */
  const widgetTypes = Object.keys(widgets);
  const activeWidgetType = useLiveKitStore((s) => s.activeWidgetType);
  const setActiveWidgetType = useLiveKitStore((s) => s.setActiveWidgetType);
  const prevWidgetTypesRef = useRef([]);
  
  const handleTabSwitch = (type) => setActiveWidgetType(type);

  const handleTabClose = (type) => {
    if (type === activeWidgetType) {
      const idx  = widgetTypes.indexOf(type);
      const next = widgetTypes[idx + 1] ?? widgetTypes[idx - 1] ?? null;
      setActiveWidgetType(next);
    }
    clearWidget(type);
  };

  /* Derive whether any widgets are active */
  const hasWidgets = widgetTypes.length > 0;

  /* Animate PiP tile whenever widget mode activates */
  useEffect(() => {
    if (hasWidgets && !pipMinimized && pipRef.current) {
      gsap.fromTo(
        pipRef.current,
        { opacity: 0, scale: 0.55, x: 30, y: 30 },
        { opacity: 1, scale: 1, x: 0, y: 0, duration: 0.5, ease: "back.out(1.6)" }
      );
    }
  }, [hasWidgets]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Reset minimized state when all widgets close */
  useEffect(() => {
    if (!hasWidgets) setPipMinimized(false);
  }, [hasWidgets]);

  /* Re-animate PiP when restored from minimized state */
  useEffect(() => {
    if (!pipMinimized && hasWidgets && pipRef.current) {
      gsap.fromTo(pipRef.current,
        { opacity: 0, scale: 0.5, x: 0, y: 0 },
        { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(1.5)" }
      );
    }
  }, [pipMinimized]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Start call timer on mount */
  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed((t) => t + 1), 1000);
    return () => {
      clearInterval(timerRef.current)
      setActiveWidgetType(null);
    };
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

  /* PiP minimize / restore */
  const handlePipMinimize = () => {
    if (!pipRef.current) return;
    gsap.to(pipRef.current, {
      opacity: 0, scale: 0.4, duration: 0.22, ease: "power2.in",
      onComplete: () => setPipMinimized(true),
    });
  };

  const handlePipRestore = () => setPipMinimized(false);

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

            {/* Widget tabs — scroll horizontally in the header centre */}
            {hasWidgets && (
              <div className={styles.headerTabs} role="tablist" aria-label="Widget tabs">
                {widgetTypes.map((type) => {
                  const label    = WIDGET_REGISTRY[type]?.label ?? type;
                  const isActive = type === activeWidgetType;
                  return (
                    <button
                      key={type}
                      role="tab"
                      aria-selected={isActive}
                      className={`${styles.headerTab} ${isActive ? styles.headerTabActive : ""}`}
                      onClick={() => handleTabSwitch(type)}
                    >
                      <span className={styles.headerTabIcon}><TabIcon type={type} /></span>
                      <span className={styles.headerTabLabel}>{label}</span>
                      <span
                        className={styles.headerTabClose}
                        role="button"
                        tabIndex={0}
                        aria-label={`Close ${label}`}
                        onClick={(e) => { e.stopPropagation(); handleTabClose(type); }}
                        onKeyDown={(e) => e.key === "Enter" && handleTabClose(type)}
                      >
                        <svg viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                          <path d="M8 2L2 8M2 2l6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                        </svg>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className={styles.topRight}>
              <span className={styles.timer}>{formatTime(elapsed)}</span>
            </div>
          </header>

          {/* Content: widget grid OR video/voice (full-size) */}
          <div className={styles.contentArea}>
            {hasWidgets ? (
              /*
                Widget mode — WidgetGrid fills the content area.
                Supports 1, 2, 3+ simultaneous widgets (CPU + Disk + ...).
                The video/audio shrinks to a PiP tile in the corner.
              */
              <>
                <WidgetPanel widgets={widgets} activeType={activeWidgetType} />
                {/* PiP: minimised video / voice tile — GSAP animated in */}
                <div
                  ref={pipRef}
                  className={`${styles.pip} ${pipMinimized ? styles.pipHidden : ""}`}
                  style={{ opacity: 0 }}
                >
                  {callType === "video" ? <AvatarVideo /> : <VoicePlaceholder />}
                  {/* Minimize-to-toolbar overlay — visible on .pip:hover */}
                  <div className={styles.pipControls}>
                    <button
                      className={styles.pipMinimizeBtn}
                      onClick={handlePipMinimize}
                      aria-label="Minimize to toolbar"
                    >
                      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                        <line x1="4" y1="19" x2="20" y2="19" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* Normal mode — video or voice fills the entire content area */
              <div className={styles.videoArea}>
                {callType === "video" ? <AvatarVideo /> : <VoicePlaceholder />}
              </div>
            )}
          </div>

          {/* Footer toolbar */}
          <footer className={styles.toolbar}>

          {/* PiP mini thumb — appears in toolbar when PiP is minimized */}
          {hasWidgets && pipMinimized && (
            <div ref={pipThumbRef} className={styles.pipThumb}>
              <div className={styles.pipThumbIcon}>
                {callType === "video" ? (
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <rect x="2" y="7" width="15" height="10" rx="2" stroke="currentColor" strokeWidth="1.8"/>
                    <path d="M17 10l5-3v10l-5-3V10z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" stroke="currentColor" strokeWidth="1.8"/>
                    <path d="M19 10a7 7 0 0 1-14 0M12 19v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                )}
              </div>
              <span className={styles.pipThumbLabel}>AI</span>
              <button
                className={styles.pipRestoreBtn}
                onClick={handlePipRestore}
                aria-label="Restore picture-in-picture"
              >
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          )}

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
