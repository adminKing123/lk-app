import { create } from "zustand";

/**
 * useLiveKitStore — Zustand store managing the entire LiveKit session lifecycle.
 *
 * Connection state machine:
 *   'idle'       → start screen, nothing connected
 *   'connecting' → token fetch in-flight
 *   'connected'  → LiveKitRoom is mounted and agent has joined
 *   'error'      → token fetch or connection failed
 *
 * Agent state mirrors the LiveKit participant attribute "lk.agent.state":
 *   'connecting' | 'initializing' | 'listening' | 'thinking' | 'speaking' | 'idle'
 */
const useLiveKitStore = create((set, get) => ({
  /* ── Session ── */
  connectionState: "idle",  // 'idle' | 'connecting' | 'connected' | 'error'
  token: null,
  livekitUrl: "",
  roomName: null,
  connectionError: null,

  /* ── Call type: 'video' uses LiveAvatar, 'voice' is audio-only ── */
  callType: "video",  // 'video' | 'voice'

  /* ── Participant display name (set by user or auto-generated) ── */
  participantName: "",

  /* ── Preferred language for the AI to respond in ── */
  language: "en",  // BCP-47 language code

  /* ── Agent ── */
  agentState: "connecting",

  /* ── Microphone toggle (synced to LiveKit by MicBridge inside RoomProvider) ── */
  isMicOn: false,

  /* ── Transcripts (agent + user, streamed segments upserted by ID) ── */
  /** @type {{ id: string, sender: 'agent'|'user', text: string, isFinal: boolean }[]} */
  transcripts: [],

  /* ── Active widgets — keyed by widget type (e.g. 'cpu', 'disk') ──
   *
   * Using a map instead of a single slot means the agent can push multiple
   * widget types simultaneously (CPU + Disk + ...) and each occupies its own
   * slot.  The WidgetGrid component renders all active entries at once.
   *
   * Shape: { [type: string]: object }  e.g. { cpu: {...}, disk: {...} }
   */
  widgets: {},

  /* ── Text send function — set by TextSendBridge when inside a LiveKitRoom ── */
  /** @type {((text: string) => Promise<void>) | null} */
  sendText: null,

  /* ── Actions ── */

  /**
   * Fetch a signed token from the backend and transition to 'connected'.
   * @param {object} opts
   * @param {'video'|'voice'} opts.callType        - Whether to use LiveAvatar or audio-only.
   * @param {string}          opts.participantName - User's display name (optional).
   * @param {string}          opts.language        - BCP-47 language code for AI responses.
   */
  connect: async ({ callType = "video", participantName = "", language = "en" } = {}) => {
    if (get().connectionState === "connecting") return;

    const backendUrl = import.meta.env.VITE_BACKEND_URL ?? "";
    const tokenEndpoint = backendUrl ? `${backendUrl}/token` : "/api/token";

    set({ connectionState: "connecting", connectionError: null });

    try {
      const roomName = `room-${Date.now()}`;
      // Use provided name if given, otherwise generate an anonymous identity
      const finalName = participantName.trim() || `user-${Math.random().toString(36).slice(2, 7)}`;

      const res = await fetch(tokenEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_name: roomName, participant_name: finalName, call_type: callType, language }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Token request failed (${res.status}): ${text}`);
      }

      /** @type {{ token: string, room_name: string, livekit_url?: string }} */
      const data = await res.json();

      const livekitUrl = data.livekit_url || import.meta.env.VITE_LIVEKIT_URL || "";
      if (!livekitUrl) {
        throw new Error("LiveKit URL is not configured. Set VITE_LIVEKIT_URL in .env");
      }

      set({
        token: data.token,
        roomName: data.room_name ?? roomName,
        livekitUrl,
        callType,
        participantName: finalName,
        language,
        connectionState: "connected",
      });
    } catch (err) {
      set({
        connectionState: "error",
        connectionError: err instanceof Error ? err.message : String(err),
      });
    }
  },

  /** Reset everything and return to the start screen. */
  disconnect: () =>
    set({
      connectionState: "idle",
      token: null,
      roomName: null,
      connectionError: null,
      agentState: "connecting",
      callType: "video",
      participantName: "",
      language: "en",
      isMicOn: false,
      transcripts: [],
      widgets: {},
      sendText: null,
    }),

  /** Updated by RoomBridge when the agent's lk.agent.state attribute changes. */
  setAgentState: (state) => set({ agentState: state }),

  /** Toggle the microphone on or off. MicBridge inside RoomProvider applies it. */
  setMicOn: (on) => set({ isMicOn: on }),

  /**
   * Called by DataBridge when the agent publishes a widget payload via the
   * LiveKit data channel (topic: 'widget.*').
   * Upserts the widget into the map by its type — existing widgets of other
   * types are preserved, so CPU and Disk (etc.) can coexist.
   * @param {object} data - Parsed JSON payload; must contain a `type` string.
   */
  setWidget: (data) =>
    set((s) => ({ widgets: { ...s.widgets, [data.type]: data } })),

  /**
   * Dismiss a single widget by type and return that slot to the normal view.
   * Other active widgets are unaffected.
   * @param {string} type - e.g. 'cpu' | 'disk'
   */
  clearWidget: (type) =>
    set((s) => {
      const next = { ...s.widgets };
      delete next[type];
      return { widgets: next };
    }),

  /** Dismiss all widgets at once (e.g. when the call ends). */
  clearAllWidgets: () => set({ widgets: {} }),

  /**
   * Registered by TextSendBridge (inside LiveKitRoom) to expose the LiveKit
   * sendText API to components outside the room context.
   * @param {((text: string) => Promise<void>) | null} fn
   */
  setSendText: (fn) => set({ sendText: fn }),

  /**
   * Upsert a transcript segment — handles LiveKit's streaming partial segments.
   * When isFinal === true the segment is complete; new partials get a new ID.
   *
   * @param {{ id: string, sender: 'agent'|'user', text: string, isFinal: boolean }} segment
   */
  upsertTranscript: (segment) =>
    set((s) => {
      const idx = s.transcripts.findIndex((t) => t.id === segment.id);
      if (idx !== -1) {
        const updated = [...s.transcripts];
        updated[idx] = segment;
        return { transcripts: updated };
      }
      return { transcripts: [...s.transcripts, segment] };
    }),

  activeWidgetType: null, // e.g. 'cpu' or 'disk' — used by WidgetPanel to know which tab to show
  setActiveWidgetType: (type) => set({ activeWidgetType: type }),
}));

export default useLiveKitStore;

