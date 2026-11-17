import { useEffect, useRef, useState } from 'react';
import useEditorStore from '../../store/editorStore';
import useSettingsStore from '../../store/settingsStore';

const nameOf = (u) => u?.display_name || u?.email || 'Someone';

// Screen-reader announcements for what collaborators do (Settings > Accessibility).
// One polite live region; each message replaces the last.
export default function Announcer({ userId }) {
  const enabled = useSettingsStore((s) => s.announce);
  const presence = useEditorStore((s) => s.presence);
  const driver = useEditorStore((s) => s.driver);
  const [message, setMessage] = useState('');
  const known = useRef(null);
  const lastDriver = useRef(driver);

  useEffect(() => {
    const now = new Map(presence.filter((u) => u.id !== userId).map((u) => [u.id, u]));
    if (known.current) {
      const joined = [...now.values()].filter((u) => !known.current.has(u.id)).map(nameOf);
      const left = [...known.current.values()].filter((u) => !now.has(u.id)).map(nameOf);
      const parts = [joined.length && `${joined.join(', ')} joined`, left.length && `${left.join(', ')} left`].filter(Boolean);
      if (parts.length) setMessage(parts.join('. '));
    }
    known.current = now; // the first list is who was already here: not news
  }, [presence, userId]);

  useEffect(() => {
    if (lastDriver.current === driver) return;
    lastDriver.current = driver;
    const who = presence.find((u) => u.id === driver);
    setMessage(!driver ? 'Pair mode ended' : driver === userId ? "You're driving now" : `${nameOf(who)} is driving`);
  }, [driver]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onSignal = (e) => {
      const { type, data, from } = e.detail || {};
      if (type !== 'ping' || from?.id === userId) return;
      const file = useEditorStore.getState().files.find((f) => f.id === data?.fileId);
      setMessage(`${nameOf(from)} is pointing at line ${data.line}${file ? ` of ${file.name}` : ''}`);
    };
    window.addEventListener('devsync:signal', onSignal);
    return () => window.removeEventListener('devsync:signal', onSignal);
  }, [userId]);

  return <div aria-live="polite" aria-atomic="true" className="sr-only">{enabled ? message : ''}</div>;
}
