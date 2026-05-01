import { useEffect } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRemoteParticipants,
  useRoomContext,
  useLocalParticipant,
} from "@livekit/components-react";
import { RoomEvent, ParticipantKind } from "livekit-client";
import "@livekit/components-styles";

import useLiveKitStore from "../../store/useLiveKitStore";

/** The attribute key the LiveKit Agents SDK writes on the agent participant. */
const AGENT_STATE_ATTR = "lk.agent.state";

/* ─────────────────────────────────────────────────────────────────────────────
   RoomBridge — pure side-effect component (renders nothing).

   Responsibilities:
     1. Sync agent state changes (lk.agent.state attribute) → store.
     2. Sync initial agent state when the agent participant first joins.
     3. Forward real-time transcription segments → store for display.
───────────────────────────────────────────────────────────────────────────── */
function RoomBridge() {
  const setAgentState    = useLiveKitStore((s) => s.setAgentState);
  const upsertTranscript = useLiveKitStore((s) => s.upsertTranscript);

  const room               = useRoomContext();
  const remoteParticipants = useRemoteParticipants();
  const agentParticipant   = remoteParticipants.find(
    (p) => p.kind === ParticipantKind.AGENT
  );

  // Sync agent state on every attribute-changed event from the agent
  useEffect(() => {
    const onAttrsChanged = (changedAttrs, participant) => {
      if (participant.kind !== ParticipantKind.AGENT) return;
      if (!(AGENT_STATE_ATTR in changedAttrs)) return;
      setAgentState(changedAttrs[AGENT_STATE_ATTR] ?? "idle");
    };
    room.on(RoomEvent.ParticipantAttributesChanged, onAttrsChanged);
    return () => room.off(RoomEvent.ParticipantAttributesChanged, onAttrsChanged);
  }, [room, setAgentState]);

  // Sync initial agent state when the agent joins the room
  useEffect(() => {
    if (!agentParticipant) {
      setAgentState("connecting");
      return;
    }
    setAgentState(agentParticipant.attributes?.[AGENT_STATE_ATTR] ?? "idle");
  }, [agentParticipant, setAgentState]);

  // Collect streaming transcription segments
  useEffect(() => {
    const onTranscription = (segments, participant) => {
      const sender = participant?.kind === ParticipantKind.AGENT ? "agent" : "user";
      segments.forEach((seg) => {
        upsertTranscript({
          id:      seg.id,
          sender,
          text:    seg.text,
          isFinal: seg.final,
        });
      });
    };
    room.on(RoomEvent.TranscriptionReceived, onTranscription);
    return () => room.off(RoomEvent.TranscriptionReceived, onTranscription);
  }, [room, upsertTranscript]);

  return null;
}

/* ─────────────────────────────────────────────────────────────────────────────
   DataBridge — listens for agent data-channel messages and pushes parsed
   widget payloads into the Zustand store.

   The agent publishes JSON on topic-namespaced channels (e.g. 'widget.cpu').
   Any topic matching 'widget.*' is parsed and upserted into the widgets map
   in the store, keyed by widget type — so CPU and Disk can coexist.
───────────────────────────────────────────────────────────────────────────── */
function DataBridge() {
  const room      = useRoomContext();
  const setWidget = useLiveKitStore((s) => s.setWidget);
  const setActiveWidgetType = useLiveKitStore((s) => s.setActiveWidgetType);

  useEffect(() => {
    const onData = (payload, _participant, _kind, topic) => {
      // Only handle widget data-channel messages
      if (!topic?.startsWith("widget.")) return;

      try {
        const data = JSON.parse(new TextDecoder().decode(payload));
        // data.type is the widget key (e.g. 'cpu', 'disk') — upsert into map
        if (data?.type) setWidget(data);
        if (data?.type) {
          setActiveWidgetType(data.type)
        }; // auto-switch to new widget tab
      } catch {
        // Malformed payload — silently ignore
      }
    };

    room.on(RoomEvent.DataReceived, onData);
    return () => room.off(RoomEvent.DataReceived, onData);
  }, [room, setWidget]);

  return null;
}

/* ─────────────────────────────────────────────────────────────────────────────
   TextSendBridge — exposes localParticipant.sendText to the Zustand store.

   Must live inside <LiveKitRoom> so useLocalParticipant() resolves.
   Registers a stable send function in the store when the local participant is
   available, and removes it on unmount so stale references are never called.
───────────────────────────────────────────────────────────────────────────── */
function TextSendBridge() {
  const { localParticipant } = useLocalParticipant();
  const setSendText          = useLiveKitStore((s) => s.setSendText);

  useEffect(() => {
    if (!localParticipant) return;

    setSendText((text) => localParticipant.sendText(text, { topic: "lk.chat" }));

    return () => setSendText(null);
  }, [localParticipant, setSendText]);

  return null;
}

/* ─────────────────────────────────────────────────────────────────────────────
   MicBridge — syncs store.isMicOn → the real LiveKit microphone track.

   Must live inside <LiveKitRoom> so useLocalParticipant() resolves.
   The mic starts muted (audio={false} on LiveKitRoom); this component
   calls setMicrophoneEnabled() whenever the store flag changes.
───────────────────────────────────────────────────────────────────────────── */
function MicBridge() {
  const isMicOn            = useLiveKitStore((s) => s.isMicOn);
  const { localParticipant } = useLocalParticipant();

  useEffect(() => {
    if (!localParticipant) return;
    localParticipant.setMicrophoneEnabled(isMicOn).catch(() => {
      // Silently ignore — browser may deny or delay mic permission
    });
  }, [isMicOn, localParticipant]);

  return null;
}

/* ─────────────────────────────────────────────────────────────────────────────
   RoomProvider — wraps children inside a LiveKitRoom.

   Only renders when connectionState === "connected" and a token is available.
   Children that use LiveKit hooks (useRemoteParticipants, useTracks, etc.)
   must be rendered as children of this component.

   @param {{ children: React.ReactNode }} props
───────────────────────────────────────────────────────────────────────────── */
function RoomProvider({ children }) {
  const connectionState = useLiveKitStore((s) => s.connectionState);
  const token           = useLiveKitStore((s) => s.token);
  const livekitUrl      = useLiveKitStore((s) => s.livekitUrl);
  const disconnect      = useLiveKitStore((s) => s.disconnect);

  if (connectionState !== "connected" || !token) return null;

  return (
    <LiveKitRoom
      token={token}
      serverUrl={livekitUrl}
      connect={true}
      audio={false}   /* Mic starts muted — MicBridge enables it when isMicOn is true */
      video={false}
      onDisconnected={disconnect}
      style={{ display: "contents" }}
    >
      {/* Plays the agent's TTS audio automatically */}
      <RoomAudioRenderer />

      {/* Bridges room events into the Zustand store */}
      <RoomBridge />

      {/* Syncs isMicOn store flag → real mic mute/unmute */}
      <MicBridge />

      {/* Listens for agent data-channel messages → upserts into widgets map in store */}
      <DataBridge />

      {/* Exposes localParticipant.sendText to the Zustand store for the chat input */}
      <TextSendBridge />

      {children}
    </LiveKitRoom>
  );
}

export default RoomProvider;
