import { useEffect, useState } from 'react';
import { VscGithub } from 'react-icons/vsc';
import { api } from '../../lib/api';
import { connectGitHub, useGitHub } from '../../lib/github';
import { toast } from '../../store/toastStore';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Alert from '../ui/Alert';

const slug = (name = '') => name.trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100) || 'devsync-project';

// Editor: send this workspace's changes to its GitHub repo, or (owner) put it in a new repo
export default function GitHubModal({ isOpen, onClose, workspace }) {
  const [state, setState, loadError] = useGitHub(`/api/workspaces/${workspace.id}/github`, isOpen);
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState('pr');
  const [branch, setBranch] = useState('');
  const [repoName, setRepoName] = useState(slug(workspace.name));
  const [isPrivate, setIsPrivate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null); // { url, label }

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setDone(null);
  }, [isOpen]);

  const run = async (fn) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  const send = (e) => {
    e.preventDefault();
    run(async () => {
      const { url } = await api(`/api/workspaces/${workspace.id}/github/push`, { method: 'POST', body: { message: message.trim(), mode, branch: branch.trim() } });
      setDone({ url, label: mode === 'pr' ? 'View the pull request' : 'View the commit' });
      setMessage('');
      setBranch('');
    });
  };
  const createRepo = (e) => {
    e.preventDefault();
    run(async () => {
      const r = await api(`/api/workspaces/${workspace.id}/github/repo`, { method: 'POST', body: { name: repoName.trim(), private: isPrivate } });
      setState({ ...state, link: r.link });
      setDone({ url: r.url, label: `Open ${r.link.repo}` });
    });
  };
  const unlink = () => run(async () => {
    await api(`/api/workspaces/${workspace.id}/github`, { method: 'DELETE' });
    setState({ ...state, link: null });
    toast('Unlinked from GitHub. The repo itself is untouched.');
  });

  const link = state?.link;
  const canPush = state && state.role !== 'viewer';
  const isOwner = state?.role === 'owner';
  const formId = link ? 'github-push-form' : 'github-create-form';
  const showForm = state?.configured && state?.login && !done && (link ? canPush : isOwner);

  let body;
  if (loadError) body = <Alert>{loadError}</Alert>;
  else if (!state) body = <p className="text-body-sm text-ink-muted">Loading…</p>;
  else if (!state.configured) body = <p className="text-body-sm text-ink-muted">GitHub isn't set up on this server yet.</p>;
  else if (done) {
    body = (
      <div className="space-y-2">
        <p className="rounded-md border border-brand/25 bg-brand-soft px-3 py-2 text-body-sm text-brand-fg">Sent to GitHub.</p>
        <a className="text-label-md text-brand-fg hover:underline" href={done.url} target="_blank" rel="noopener noreferrer">{done.label} ↗</a>
      </div>
    );
  } else if (!state.login) {
    body = (
      <div className="flex flex-col items-start gap-3">
        <p className="text-body-sm text-ink-muted">Changes go to GitHub as you, so connect your GitHub account first. You'll come right back here.</p>
        <Button onClick={connectGitHub}><VscGithub size={16} aria-hidden="true" /> Connect GitHub</Button>
      </div>
    );
  } else if (!link && !isOwner) {
    body = <p className="text-body-sm text-ink-muted">This workspace isn't linked to a GitHub repo. Its owner can create one for it.</p>;
  } else if (!link) {
    body = (
      <form id={formId} onSubmit={createRepo} className="space-y-4">
        <p className="text-body-sm text-ink-muted">Create a repo on your GitHub account ({state.login}) with this workspace's files. After that, send changes whenever you like.</p>
        <Input label="Repo name" value={repoName} onChange={(e) => setRepoName(e.target.value)} maxLength={100} pattern="[A-Za-z0-9_.\-]+" title='Letters, numbers, ".", "_" and "-"' required />
        <label className="flex cursor-pointer items-center gap-2.5 text-body-sm text-ink">
          <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--brand))]" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
          Private (only you and people you add on GitHub can see it)
        </label>
        {error && <Alert>{error}</Alert>}
      </form>
    );
  } else {
    body = (
      <form id={formId} onSubmit={send} className="space-y-4">
        <p className="flex items-center gap-2 text-body-sm text-ink">
          <VscGithub size={16} aria-hidden="true" />
          Linked to <a className="font-medium hover:underline" href={`https://github.com/${link.repo}`} target="_blank" rel="noopener noreferrer">{link.repo}</a>
          <span className="text-ink-muted">({link.branch})</span>
        </p>
        {!canPush ? (
          <p className="text-body-sm text-ink-muted">Only editors can send changes to GitHub.</p>
        ) : (
          <>
            <Input label="What changed?" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Fix the login bug" maxLength={200} autoFocus />
            <fieldset className="space-y-2">
              <legend className="text-label-md text-ink">How</legend>
              <label className="flex cursor-pointer items-start gap-2.5 text-body-sm text-ink">
                <input type="radio" name="mode" className="mt-1 accent-[rgb(var(--brand))]" checked={mode === 'pr'} onChange={() => setMode('pr')} />
                <span>Open a pull request<span className="block text-label-sm text-ink-muted">Safe even if someone changed the repo on GitHub. Review and merge it there.</span></span>
              </label>
              {mode === 'pr' && (
                <div className="pl-6">
                  <Input label="New branch" value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="Picked for you if empty" maxLength={100} />
                </div>
              )}
              <label className="flex cursor-pointer items-start gap-2.5 text-body-sm text-ink">
                <input type="radio" name="mode" className="mt-1 accent-[rgb(var(--brand))]" checked={mode === 'direct'} onChange={() => setMode('direct')} />
                <span>Commit straight to {link.branch}<span className="block text-label-sm text-ink-muted">Only works if nobody else has pushed to it since the last sync.</span></span>
              </label>
            </fieldset>
          </>
        )}
        {error && <Alert>{error}</Alert>}
      </form>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="GitHub"
      description="Send this workspace's code to GitHub. Everything is sent as it is right now, live edits included."
      footer={
        <>
          {link && isOwner && !done && <Button variant="ghost" className="mr-auto" onClick={unlink} disabled={busy}>Unlink</Button>}
          <Button variant="secondary" onClick={onClose}>{done ? 'Done' : 'Cancel'}</Button>
          {showForm && <Button type="submit" form={formId} loading={busy}>{link ? 'Send to GitHub' : 'Create repo'}</Button>}
        </>
      }
    >
      {body}
    </Modal>
  );
}
