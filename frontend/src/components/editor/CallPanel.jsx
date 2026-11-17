import { useState } from 'react';
import { LiveKitRoom, GridLayout, ParticipantTile, ControlBar, RoomAudioRenderer, useTracks, useParticipants } from '@livekit/components-react';
import { Track } from 'livekit-client';
import '@livekit/components-styles';
import { GoScreenFull, GoScreenNormal, GoX } from 'react-icons/go';
import { toast } from '../../store/toastStore';

function Stage() {
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }, { source: Track.Source.ScreenShare, withPlaceholder: false }],
    { onlySubscribed: false },
  );
  return (
    <GridLayout tracks={tracks} className="min-h-0 flex-1">
      <ParticipantTile />
    </GridLayout>
  );
}

function Count() {
  const n = useParticipants().length;
  return <span className="text-label-sm text-ink-muted">{n} in the call</span>;
}

// The workspace's huddle (LiveKit). Floats over the editor, so you can keep coding while you talk.
// Joins with the microphone on and the camera off.
export default function CallPanel({ call, onLeave }) {
  const [big, setBig] = useState(false);
  return (
    <section
      aria-label="Huddle"
      className={`menu fixed z-[65] flex flex-col overflow-hidden p-0 ${big ? 'inset-4 sm:inset-10' : 'bottom-4 right-4 h-[300px] w-[min(400px,calc(100vw-32px))]'}`}
    >
      <LiveKitRoom
        serverUrl={call.url}
        token={call.token}
        connect
        audio
        video={false}
        onDisconnected={onLeave}
        onError={(err) => toast(`Call problem: ${err.message}`, { tone: 'error' })}
        onMediaDeviceFailure={() => toast("Couldn't use your microphone or camera. Check the browser's permission.", { tone: 'error' })}
        data-lk-theme="default"
        className="devsync-call flex min-h-0 flex-1 flex-col"
      >
        <header className="flex h-9 shrink-0 items-center gap-2 border-b border-line bg-canvas px-3">
          <span className="text-label-md text-ink">Huddle</span>
          <Count />
          <button type="button" onClick={() => setBig((v) => !v)} className="icon-btn ml-auto h-7 w-7" aria-label={big ? 'Make smaller' : 'Make bigger'}>
            {big ? <GoScreenNormal size={14} /> : <GoScreenFull size={14} />}
          </button>
          <button type="button" onClick={onLeave} className="icon-btn h-7 w-7" aria-label="Leave huddle"><GoX size={14} /></button>
        </header>
        <Stage />
        <RoomAudioRenderer />
        <ControlBar variation="minimal" controls={{ microphone: true, camera: true, screenShare: true, leave: true, chat: false, settings: false }} />
      </LiveKitRoom>
    </section>
  );
}
