import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { toast } from '../../store/toastStore';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Alert from '../ui/Alert';

const KINDS = [
  ['tests', 'Tests break or pass again', 'Needs live tests turned on (Tests › Rerun on every save).'],
  ['tasks', 'A task is finished'],
  ['events', 'A new event is planned'],
  ['members', 'Someone joins the workspace'],
];

// Owner-only: post workspace updates to a Slack or Discord channel through an incoming webhook
export default function AlertsModal({ isOpen, onClose, workspaceId }) {
  const [state, setState] = useState(null); // { service, events }
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setUrl('');
    setError('');
    api(`/api/workspaces/${workspaceId}/webhook`).then((s) => { setState(s); setEvents(s.events); }).catch((err) => setError(err.message));
  }, [isOpen, workspaceId]);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const s = await api(`/api/workspaces/${workspaceId}/webhook`, { method: 'PUT', body: { url: url.trim() || undefined, events } });
      setState(s);
      setUrl('');
      toast(url.trim() ? `Connected. Check your ${s.service === 'slack' ? 'Slack' : 'Discord'} channel for a hello message.` : 'Alerts updated', { tone: 'success' });
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };
  const disconnect = async () => {
    setBusy(true);
    try {
      setState(await api(`/api/workspaces/${workspaceId}/webhook`, { method: 'DELETE' }));
      toast('Alerts turned off');
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };
  const toggle = (kind) => setEvents((list) => (list.includes(kind) ? list.filter((k) => k !== kind) : [...list, kind]));
  const connected = state?.service;
  const serviceName = connected === 'slack' ? 'Slack' : 'Discord';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Slack and Discord alerts"
      description="Post updates from this workspace to a channel your team already watches."
      footer={
        <>
          {connected && <Button variant="ghost" className="mr-auto text-danger" onClick={disconnect} disabled={busy}>Disconnect</Button>}
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button type="submit" form="alerts-form" loading={busy} disabled={!state || (!connected && !url.trim())}>{connected && !url.trim() ? 'Save' : 'Connect'}</Button>
        </>
      }
    >
      <form id="alerts-form" onSubmit={save} className="space-y-5">
        {connected && <p className="rounded-md border border-brand/25 bg-brand-soft px-3 py-2 text-body-sm text-brand-fg">Connected to {serviceName}.</p>}
        <Input
          label={connected ? 'Switch to another channel (optional)' : 'Webhook URL'}
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError(''); }}
          placeholder="https://hooks.slack.com/services/… or https://discord.com/api/webhooks/…"
          autoComplete="off"
          hint={
            <>
              Slack: <a className="underline" href="https://api.slack.com/messaging/webhooks" target="_blank" rel="noopener noreferrer">create an incoming webhook</a>.
              Discord: channel settings › Integrations › Webhooks › New webhook › Copy URL.
            </>
          }
        />
        <fieldset>
          <legend className="text-label-md text-ink">Post when</legend>
          <ul className="mt-2 space-y-2">
            {KINDS.map(([kind, label, hint]) => (
              <li key={kind}>
                <label className="flex cursor-pointer items-start gap-2.5 text-body-sm text-ink">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[rgb(var(--brand))]" checked={events.includes(kind)} onChange={() => toggle(kind)} />
                  <span>{label}{hint && <span className="block text-label-sm text-ink-muted">{hint}</span>}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
        {error && <Alert>{error}</Alert>}
      </form>
    </Modal>
  );
}
