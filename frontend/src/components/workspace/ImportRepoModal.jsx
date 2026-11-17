import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { VscGithub } from 'react-icons/vsc';
import { GoLock, GoSearch } from 'react-icons/go';
import { api } from '../../lib/api';
import { connectGitHub, useGitHub } from '../../lib/github';
import { toast } from '../../store/toastStore';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Alert from '../ui/Alert';

const PASTED = /^(?:https?:\/\/github\.com\/)?([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?\/?$/i;

// Dashboard: bring one of your GitHub repos in as a new workspace
export default function ImportRepoModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const [status, , statusError] = useGitHub('/api/github', isOpen);
  const [repos, , reposError] = useGitHub('/api/github/repos', isOpen && !!status?.login);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (repos || []).filter((r) => !q || r.repo.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q)).slice(0, 50);
  }, [repos, query]);
  // A pasted owner/name or github.com link that isn't in the list (someone else's public repo)
  const pasted = query.trim().match(PASTED)?.[1];
  const target = picked || (pasted && !shown.some((r) => r.repo.toLowerCase() === pasted.toLowerCase()) ? pasted : '');

  const close = () => {
    if (busy) return;
    setQuery('');
    setPicked('');
    setError('');
    onClose();
  };

  const importRepo = async (e) => {
    e.preventDefault();
    if (!target) return;
    setBusy(true);
    setError('');
    try {
      const r = await api('/api/github/import', { method: 'POST', body: { repo: target } });
      const left = r.skipped || r.truncated ? ' Images, lock files and very large files were left out.' : '';
      toast(`Imported ${r.imported} files from ${target}.${left}`, { tone: 'success', duration: 7000 });
      setBusy(false);
      close();
      navigate(`/editor/${r.workspace.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const ready = status?.configured && status?.login;
  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Import from GitHub"
      description="Copies a repo's code into a new workspace. Send your changes back later as a pull request."
      footer={ready && (
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>Cancel</Button>
          <Button type="submit" form="import-repo-form" loading={busy} disabled={!target}>{busy ? 'Importing…' : 'Import'}</Button>
        </>
      )}
    >
      {statusError || (status && !status.configured) ? (
        <p className="text-body-sm text-ink-muted">{statusError || "GitHub isn't set up on this server yet."}</p>
      ) : !status ? (
        <p className="text-body-sm text-ink-muted">Loading…</p>
      ) : !status.login ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-body-sm text-ink-muted">Connect your GitHub account to see your repos. You'll come right back here.</p>
          <Button onClick={connectGitHub}><VscGithub size={16} aria-hidden="true" /> Connect GitHub</Button>
        </div>
      ) : (
        <form id="import-repo-form" onSubmit={importRepo} className="space-y-3">
          <Input
            label="Repository"
            icon={GoSearch}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPicked(''); setError(''); }}
            placeholder="Search your repos, or paste owner/name"
            autoComplete="off"
            autoFocus
          />
          <div role="radiogroup" aria-label="Your repos" className="max-h-72 overflow-y-auto rounded-md border border-line">
            {!repos && !reposError && <p className="p-3 text-body-sm text-ink-muted">Loading your repos…</p>}
            {reposError && <p className="p-3 text-body-sm text-danger">{reposError}</p>}
            {repos && shown.length === 0 && (
              <p className="p-3 text-body-sm text-ink-muted">{pasted ? `Import ${pasted}?` : 'No repos match.'}</p>
            )}
            {shown.map((r) => (
              <label key={r.repo} className={`flex cursor-pointer items-start gap-2.5 border-b border-line px-3 py-2 last:border-0 hover:bg-canvas-subtle ${picked === r.repo ? 'bg-brand-soft' : ''}`}>
                <input type="radio" name="repo" className="mt-1 accent-[rgb(var(--brand))]" checked={picked === r.repo} onChange={() => setPicked(r.repo)} />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-label-md text-ink">
                    <span className="truncate">{r.repo}</span>
                    {r.private && <GoLock size={12} className="shrink-0 text-ink-subtle" aria-label="Private" />}
                  </span>
                  {r.description && <span className="block truncate text-label-sm text-ink-muted">{r.description}</span>}
                </span>
              </label>
            ))}
          </div>
          <p className="text-label-sm text-ink-muted">Up to 200 text files. Images, lock files, node_modules and build folders are left out.</p>
          {error && <Alert>{error}</Alert>}
        </form>
      )}
    </Modal>
  );
}
