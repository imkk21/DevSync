import { useEffect, useRef, useState } from 'react';
import { GoDeviceCameraVideo, GoPlay, GoScreenFull } from 'react-icons/go';
import { supabase } from '../../lib/supabase';
import { toast } from '../../store/toastStore';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

const BUCKET = 'workspace-files';
const MAX_SECONDS = 120;
const MAX_BYTES = 10 * 1024 * 1024; // the bucket's limit
const canShareScreen = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia;
// Chrome and Firefox record WebM; Safari only MP4
const FORMAT = typeof MediaRecorder === 'undefined' ? null
  : [['video/webm;codecs=vp9,opus', 'webm'], ['video/webm', 'webm'], ['video/mp4', 'mp4']].find(([type]) => MediaRecorder.isTypeSupported(type));
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// Record your screen or camera (with your microphone) and post it in chat. Up to two minutes.
export function VideoRecorder({ isOpen, onClose, workspaceId, userId, onSent }) {
  const [phase, setPhase] = useState('pick'); // pick | recording | review
  const [seconds, setSeconds] = useState(0);
  const [clip, setClip] = useState(null); // { blob, url, seconds }
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const live = useRef(null);
  const rec = useRef(null); // { recorder, stream, timer, started }

  const release = () => {
    const r = rec.current;
    rec.current = null;
    if (!r) return;
    clearInterval(r.timer);
    r.stream.getTracks().forEach((t) => t.stop());
    r.extra?.getTracks().forEach((t) => t.stop());
  };
  const reset = () => {
    release();
    if (clip) URL.revokeObjectURL(clip.url);
    setClip(null);
    setCaption('');
    setSeconds(0);
    setPhase('pick');
  };
  useEffect(() => { if (!isOpen) reset(); }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => release, []);
  // Camera: show yourself while recording
  useEffect(() => {
    if (phase === 'recording' && live.current && rec.current) live.current.srcObject = rec.current.stream;
  }, [phase]);

  const start = async (source) => {
    let stream;
    let extra = null;
    try {
      if (source === 'screen') {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false });
        extra = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null); // talk over it if allowed
        stream = new MediaStream([...screen.getVideoTracks(), ...(extra?.getAudioTracks() || [])]);
        extra = new MediaStream([...screen.getTracks(), ...(extra?.getTracks() || [])]);
      } else {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: true });
      }
    } catch {
      return toast(source === 'screen' ? 'Screen sharing was cancelled or blocked.' : "Couldn't use your camera. Check the browser's permission.", { tone: 'error' });
    }
    const chunks = [];
    const recorder = new MediaRecorder(stream, { mimeType: FORMAT[0], videoBitsPerSecond: 550_000, audioBitsPerSecond: 48_000 });
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = () => {
      const took = Math.round((Date.now() - rec.current?.started) / 1000) || seconds;
      release();
      const blob = new Blob(chunks, { type: FORMAT[0].split(';')[0] });
      setClip({ blob, url: URL.createObjectURL(blob), seconds: Math.min(took, MAX_SECONDS) });
      setPhase('review');
    };
    const started = Date.now();
    const timer = setInterval(() => {
      const s = (Date.now() - started) / 1000;
      setSeconds(s);
      if (s >= MAX_SECONDS) recorder.state === 'recording' && recorder.stop();
    }, 250);
    rec.current = { recorder, stream, extra, timer, started };
    stream.getVideoTracks()[0].onended = () => recorder.state === 'recording' && recorder.stop(); // "Stop sharing" in the browser bar
    recorder.start(1000);
    setSeconds(0);
    setPhase('recording');
  };
  const stop = () => rec.current?.recorder.state === 'recording' && rec.current.recorder.stop();

  const send = async () => {
    if (clip.blob.size > MAX_BYTES) return toast('That clip is over 10 MB. Record a shorter one.', { tone: 'error' });
    setBusy(true);
    const path = `${workspaceId}/${Date.now()}-video-${userId}.${FORMAT[1]}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, clip.blob, { contentType: clip.blob.type });
    if (upErr) {
      setBusy(false);
      return toast(upErr.message, { tone: 'error' });
    }
    const { data, error } = await supabase.from('messages')
      .insert({ workspace_id: workspaceId, user_id: userId, body: caption.trim() || 'Video message', attachment: { kind: 'video', path, seconds: clip.seconds } })
      .select().single();
    setBusy(false);
    if (error) return toast(error.message, { tone: 'error' });
    onSent(data);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { stop(); onClose(); }}
      title="Video message"
      description="Show and tell instead of typing. Up to two minutes; your microphone is recorded too."
      footer={phase === 'review' ? (
        <>
          <Button variant="ghost" className="mr-auto" onClick={reset}>Record again</Button>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={send} loading={busy}>Send</Button>
        </>
      ) : <Button variant="secondary" onClick={() => { stop(); onClose(); }}>Cancel</Button>}
    >
      {!FORMAT ? (
        <p className="text-body-sm text-ink-muted">This browser can't record video. Try Chrome, Edge, Firefox or Safari.</p>
      ) : phase === 'pick' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {canShareScreen && (
            <button type="button" onClick={() => start('screen')} className="card flex flex-col items-center gap-2 p-6 text-center hover:border-line-strong">
              <GoScreenFull size={22} className="text-brand-fg" aria-hidden="true" />
              <span className="text-label-md text-ink">Record my screen</span>
              <span className="text-label-sm text-ink-muted">Walk through code or a bug</span>
            </button>
          )}
          <button type="button" onClick={() => start('camera')} className="card flex flex-col items-center gap-2 p-6 text-center hover:border-line-strong">
            <GoDeviceCameraVideo size={22} className="text-brand-fg" aria-hidden="true" />
            <span className="text-label-md text-ink">Record my camera</span>
            <span className="text-label-sm text-ink-muted">A quick hello or update</span>
          </button>
        </div>
      ) : phase === 'recording' ? (
        <div className="flex flex-col items-center gap-4">
          {rec.current && rec.current.extra === null && <video ref={live} autoPlay muted playsInline className="w-full rounded-md bg-black" />}
          <p className="flex items-center gap-2 text-headline-sm font-semibold tabular-nums text-ink" role="timer" aria-live="off">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-danger" aria-hidden="true" /> {clock(seconds)} <span className="text-body-sm font-normal text-ink-muted">of {clock(MAX_SECONDS)}</span>
          </p>
          <Button variant="danger" onClick={stop}>Stop recording</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <video src={clip.url} controls playsInline className="w-full rounded-md bg-black" />
          <label className="block">
            <span className="text-label-md text-ink">Message <span className="font-normal text-ink-muted">(optional)</span></span>
            <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={500} className="input mt-1.5" placeholder="What's this about?" />
          </label>
        </div>
      )}
    </Modal>
  );
}

// A clip in chat. The link is private and signed only when someone presses play.
export function VideoAttachment({ attachment }) {
  const [url, setUrl] = useState(null);
  const play = async () => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(attachment.path, 3600);
    if (error) return toast("That video isn't available anymore.", { tone: 'error' });
    setUrl(data.signedUrl);
  };
  if (url) return <video src={url} controls autoPlay playsInline className="mt-1.5 w-full max-w-[320px] rounded-md bg-black" />;
  return (
    <button type="button" onClick={play} className="mt-1.5 flex h-[120px] w-full max-w-[220px] flex-col items-center justify-center gap-1.5 rounded-md border border-line bg-canvas-muted text-ink-muted hover:text-ink">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-canvas shadow-sm"><GoPlay size={16} aria-hidden="true" /></span>
      <span className="text-label-sm">Play video{attachment.seconds ? ` · ${clock(attachment.seconds)}` : ''}</span>
    </button>
  );
}
