import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Alert from '../components/ui/Alert';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { EditorSettingsFields } from '../components/editor/SettingsModal';
import useAuthStore from '../store/authStore';
import { api } from '../lib/api';
import { toast } from '../store/toastStore';

function Section({ title, description, children }) {
  return (
    <section className="grid gap-6 border-t border-line py-8 md:grid-cols-[220px_1fr]">
      <div>
        <h2 className="text-label-lg text-ink">{title}</h2>
        {description && <p className="mt-1.5 text-body-sm text-ink-muted">{description}</p>}
      </div>
      <div className="max-w-lg">{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, profile, updateProfile, signOut } = useAuthStore();
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(profile?.display_name || '');
    setAvatar(profile?.avatar_url || '');
  }, [profile]);

  const save = async (e) => {
    e.preventDefault();
    const display = name.trim();
    if (!display) return setError('Enter a name.');
    if (avatar && !/^https:\/\//.test(avatar.trim())) return setError('The picture must be an https:// link.');
    setSaving(true);
    setError('');
    const { error: err } = await updateProfile({ display_name: display.slice(0, 60), avatar_url: avatar.trim() || null });
    setSaving(false);
    if (err) setError(err.message);
    else toast('Profile saved', { tone: 'success' });
  };

  const deleteAccount = async () => {
    setBusy(true);
    try {
      await api('/api/me', { method: 'DELETE' });
      await signOut();
      navigate('/', { replace: true });
    } catch (err) {
      toast(err.message, { tone: 'error' });
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 pb-20 pt-10 sm:px-6 lg:px-8">
        <h1 className="text-headline-md text-ink">Settings</h1>
        <p className="mt-1.5 text-body-md text-ink-muted">{user?.email}</p>

        <div className="mt-8">
          <Section title="Profile" description="How collaborators see you: on cursors, comments and chat.">
            <form onSubmit={save} noValidate className="space-y-5">
              <div className="flex items-center gap-4">
                <Avatar name={name || user?.email} id={user?.id} src={avatar || undefined} size={48} />
                <p className="text-body-sm text-ink-muted">Your picture comes from your sign-in provider unless you set a link below.</p>
              </div>
              <Input label="Display name" value={name} maxLength={60} onChange={(e) => { setName(e.target.value); setError(''); }} autoComplete="name" />
              <Input label="Picture URL" hint="Optional. An https:// link to an image." value={avatar} onChange={(e) => { setAvatar(e.target.value); setError(''); }} placeholder="https://…" autoComplete="off" />
              {error && <Alert>{error}</Alert>}
              <Button type="submit" loading={saving}>Save profile</Button>
            </form>
          </Section>

          <Section title="Editor" description="Saved in this browser.">
            <EditorSettingsFields />
          </Section>

          <Section title="Delete account" description="Permanently deletes your account and every workspace you own. Workspaces shared with you stay with their owners.">
            <Button variant="danger" onClick={() => setDeleting(true)}>Delete my account</Button>
          </Section>
        </div>
      </main>

      <ConfirmDialog
        isOpen={deleting}
        onClose={() => { setDeleting(false); setConfirm(''); }}
        onConfirm={() => confirm === 'delete' && deleteAccount()}
        loading={busy}
        title="Delete your account?"
        confirmLabel="Delete account"
      >
        <p>This can't be undone. Every workspace you own is deleted for everyone in it.</p>
        <div className="mt-4">
          <Input label='Type "delete" to confirm' value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
        </div>
      </ConfirmDialog>
    </div>
  );
}
