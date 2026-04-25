import { useRemoteParticipants, useTracks, VideoTrack } from "@livekit/components-react";
import { Track, ParticipantKind } from "livekit-client";
import styles from "./AvatarVideo.module.css";

/**
 * AvatarVideo — fills its parent container with the LiveAvatar video track.
 *
 * Must be rendered inside <RoomProvider> (i.e. inside <LiveKitRoom>).
 * Video fills the tile completely with object-fit: cover.
 */
function AvatarVideo() {
  /* Locate the AI agent participant */
  const remoteParticipants = useRemoteParticipants();
  const agentParticipant   = remoteParticipants.find(
    (p) => p.kind === ParticipantKind.AGENT
  );

  /* Subscribe to the agent's camera track (published by LiveAvatar) */
  const cameraTracks = useTracks([Track.Source.Camera], { onlySubscribed: true });
  const avatarTrack  = cameraTracks.find(
    (t) => t.participant.identity === agentParticipant?.identity
  );

  return (
    <div className={styles.tile}>
      {avatarTrack ? (
        <VideoTrack trackRef={avatarTrack} className={styles.video} />
      ) : (
        <div className={styles.placeholder}>
          <div className={styles.avatarCircle}>
            <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <circle cx="32" cy="22" r="13" stroke="currentColor" strokeWidth="2.5" />
              <path d="M8 56c0-13.3 10.7-24 24-24s24 10.7 24 24"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <p className={styles.placeholderText}>
            {agentParticipant ? "Avatar loading…" : "Waiting for AI…"}
          </p>
        </div>
      )}
    </div>
  );
}

export default AvatarVideo;
