import { useEffect, useState } from 'react';
import { GoCopy } from 'react-icons/go';
import { api } from '../../lib/api';
import { toast } from '../../store/toastStore';
import Button from '../ui/Button';

// Settings > Calendar: a private link your calendar app subscribes to, with every event in your workspaces
export default function CalendarFields() {
  const [url, setUrl] = useState(undefined); // undefined while loading, null when off
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api('/api/me/calendar').then((r) => setUrl(r.url)).catch(() => setUrl(null));
  }, []);

  const call = async (method) => {
    setBusy(true);
    try {
      setUrl((await api('/api/me/calendar', { method })).url);
      if (method === 'POST' && url) toast('New link made. The old one no longer works, so update your calendar.', { tone: 'success' });
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
    setBusy(false);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast('Calendar link copied', { tone: 'success' });
    } catch {
      toast("Couldn't copy. Select the link and copy it yourself.", { tone: 'error' });
    }
  };

  if (url === undefined) return <p className="text-body-sm text-ink-muted">Loading…</p>;
  if (!url) return <Button variant="secondary" loading={busy} onClick={() => call('POST')}>Create my calendar link</Button>;

  const webcal = url.replace(/^https?:/, 'webcal:');
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Your calendar link" className="input h-9 min-w-0 flex-1 font-mono text-code-sm" />
        <Button variant="secondary" size="sm" className="!h-9" onClick={copy}><GoCopy size={14} /> Copy</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <a className="btn btn-sm btn-primary" href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`} target="_blank" rel="noopener noreferrer">Add to Google Calendar</a>
        <a className="btn btn-sm btn-secondary" href={webcal}>Apple or Outlook</a>
      </div>
      <p className="text-body-sm text-ink-muted">
        Google Calendar checks the link every few hours, so new events can take a while to appear. Anyone with this link can see your events, so keep it private.
      </p>
      <div className="flex gap-4">
        <button type="button" disabled={busy} onClick={() => call('POST')} className="text-label-md text-ink-muted hover:text-ink">Make a new link</button>
        <button type="button" disabled={busy} onClick={() => call('DELETE')} className="text-label-md text-danger hover:underline">Turn off</button>
      </div>
    </div>
  );
}
