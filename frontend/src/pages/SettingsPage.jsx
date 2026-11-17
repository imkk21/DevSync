import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Alert from '../components/ui/Alert';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { EditorSettingsFields } from '../components/editor/SettingsModal';
import useAuthStore from '../store/authStore';
import { api } from '../lib/api';
import { toast } from '../store/toastStore';
import AvatarPicker from '../components/settings/AvatarPicker';
import PortfolioFields from '../components/settings/PortfolioFields';
import AccessibilityFields from '../components/settings/AccessibilityFields';
import CalendarFields from '../components/settings/CalendarFields';
import { isUploadedAvatar, removeOldAvatars } from '../lib/avatars';

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

  // The profile loads in the background: fill in only the fields you haven't touched yet,
  // so it never overwrites what you've already picked or typed
  const touched = useRef({ name: false, avatar: false });
  const filledFor = useRef(null);
  useEffect(() => {
    if (!profile || filledFor.current === profile.id) return;
    filledFor.current = profile.id;
    if (!touched.current.name) setName(profile.display_name || '');
    if (!touched.current.avatar) setAvatar(profile.avatar_url || '');
  }, [profile]);
  const chooseAvatar = (url) => {
    touched.current.avatar = true;
    setAvatar(url);
  };

  const save = async (e) => {
    e.preventDefault();
    const display = name.trim();
    if (!display) return setError('Enter a name.');
    setSaving(true);
    setError('');
    const { error: err } = await updateProfile({ display_name: display.slice(0, 60), avatar_url: avatar || null });
    setSaving(false);
    if (err) return setError(err.message);
    toast('Profile saved', { tone: 'success' });
    // Earlier uploads you've moved away from are deleted (keeps your folder to one photo)
    removeOldAvatars(user.id, isUploadedAvatar(avatar) ? avatar : null).catch(() => {});
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
              <AvatarPicker
                userId={user?.id}
                name={name || user?.email}
                value={avatar}
                onChange={chooseAvatar}
                providerUrl={user?.user_metadata?.avatar_url || user?.user_metadata?.picture}
              />
              <Input label="Display name" value={name} maxLength={60} onChange={(e) => { touched.current.name = true; setName(e.target.value); setError(''); }} autoComplete="name" />
              {error && <Alert>{error}</Alert>}
              <Button type="submit" loading={saving}>Save profile</Button>
            </form>
          </Section>

          <Section title="Portfolio" description="A public page with your projects and activity. Only what you choose is shown.">
            <PortfolioFields />
          </Section>

          <Section title="Calendar" description="Events from all your workspaces in Google Calendar, Apple Calendar or Outlook.">
            <CalendarFields />
          </Section>

          <Section title="Accessibility" description="Saved in this browser. Applies everywhere in DevSync.">
            <AccessibilityFields />
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
