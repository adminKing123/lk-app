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

  /* ── Agent ── */
  agentState: "connecting",

  /* ── Microphone toggle (synced to LiveKit by MicBridge inside RoomProvider) ── */
  isMicOn: false,

  /* ── Transcripts (agent + user, streamed segments upserted by ID) ── */
  /** @type {{ id: string, sender: 'agent'|'user', text: string, isFinal: boolean }[]} */
  transcripts: [],

  /* ── Actions ── */

  /**
   * Fetch a signed token from the backend and transition to 'connected'.
   * The backend (token_server.py) also dispatches the AI agent to the room.
   */
  connect: async () => {
    if (get().connectionState === "connecting") return;

    const backendUrl = import.meta.env.VITE_BACKEND_URL ?? "";
    const tokenEndpoint = backendUrl ? `${backendUrl}/token` : "/api/token";

    set({ connectionState: "connecting", connectionError: null });

    try {
      const roomName = `room-${Date.now()}`;
      const participantName = `user-${Math.random().toString(36).slice(2, 7)}`;

      const res = await fetch(tokenEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_name: roomName, participant_name: participantName }),
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
      isMicOn: false,
      transcripts: [],
    }),

  /** Updated by RoomBridge when the agent's lk.agent.state attribute changes. */
  setAgentState: (state) => set({ agentState: state }),

  /** Toggle the microphone on or off. MicBridge inside RoomProvider applies it. */
  setMicOn: (on) => set({ isMicOn: on }),

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
}));

export default useLiveKitStore;

