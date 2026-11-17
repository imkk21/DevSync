import { useState } from 'react';
import { VscGithub } from 'react-icons/vsc';
import { api } from '../../lib/api';
import { connectGitHub, useGitHub } from '../../lib/github';
import { toast } from '../../store/toastStore';
import Button from '../ui/Button';

// Settings > GitHub: connect or disconnect the account used for importing and pushing
export default function GitHubFields() {
  const [status, setStatus, error] = useGitHub('/api/github');
  const [busy, setBusy] = useState(false);

  const disconnect = async () => {
    setBusy(true);
    try {
      setStatus({ ...status, ...(await api('/api/github', { method: 'DELETE' })) });
      toast('GitHub disconnected');
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
    setBusy(false);
  };

  if (error) return <p className="text-body-sm text-danger">{error}</p>;
  if (!status) return <p className="text-body-sm text-ink-muted">Loading…</p>;
  if (!status.configured) return <p className="text-body-sm text-ink-muted">GitHub isn't set up on this server yet.</p>;
  if (!status.login) {
    return (
      <Button variant="secondary" onClick={connectGitHub}>
        <VscGithub size={16} aria-hidden="true" /> Connect GitHub
      </Button>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="flex items-center gap-2 text-body-md text-ink">
        <VscGithub size={18} aria-hidden="true" /> Connected as <a className="font-medium hover:underline" href={`https://github.com/${status.login}`} target="_blank" rel="noopener noreferrer">{status.login}</a>
      </p>
      <Button variant="secondary" size="sm" loading={busy} onClick={disconnect}>Disconnect</Button>
    </div>
  );
}
