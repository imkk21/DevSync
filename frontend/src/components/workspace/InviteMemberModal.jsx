import { useState } from 'react';
import { GoMail } from 'react-icons/go';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Alert from '../ui/Alert';
import Avatar from '../ui/Avatar';

const FORM_ID = 'invite-member-form';
const ROLES = [
  { id: 'editor', label: 'Editor', text: 'Can edit and run code' },
  { id: 'viewer', label: 'Viewer', text: 'Can view and run code' },
];
const ROLE_ORDER = { owner: 0, editor: 1, viewer: 2 };
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export default function InviteMemberModal({ isOpen, onClose, onInvite, members = [], currentUserId }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('editor');
  const [error, setError] = useState('');
  const [invited, setInvited] = useState(null);
  const [loading, setLoading] = useState(false);

  const close = () => {
    setEmail('');
    setRole('editor');
    setError('');
    setInvited(null);
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return setError('Enter a valid email address.');

    setLoading(true);
    setError('');
    setInvited(null);
    const result = await onInvite(value, role);
    setLoading(false);
    if (result?.error) return setError(result.error.message || 'Could not invite this person.');
    // Stay open so the new person shows up in the list below
    setInvited({ email: value, role });
    setEmail('');
  };

  const people = [...members].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Share workspace"
      description="Invite people who have signed in to DevSync at least once."
      footer={
        <>
          <Button variant="secondary" onClick={close}>Done</Button>
          <Button type="submit" form={FORM_ID} loading={loading}>Send invite</Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="space-y-5">
        <Input
          label="Email address"
          type="email"
          icon={GoMail}
          placeholder="teammate@example.com"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(''); }}
          error={error}
          autoComplete="off"
        />

        <fieldset>
          <legend className="text-label-md text-ink">Role</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {ROLES.map((r) => {
              const selected = role === r.id;
              return (
                <label
                  key={r.id}
                  className={`cursor-pointer rounded-md border p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand has-[:focus-visible]:ring-offset-1 ${
                    selected ? 'border-brand bg-brand-soft' : 'border-line-strong hover:border-line-emphasis hover:bg-canvas-subtle'
                  }`}
                >
                  <input type="radio" name="role" value={r.id} checked={selected} onChange={() => setRole(r.id)} className="sr-only" />
                  <span className="flex items-center gap-2 text-label-md text-ink">
                    <span
                      aria-hidden="true"
                      className={`flex h-4 w-4 items-center justify-center rounded-full border ${selected ? 'border-brand' : 'border-line-emphasis'}`}
                    >
                      {selected && <span className="h-2 w-2 rounded-full bg-brand" />}
                    </span>
                    {r.label}
                  </span>
                  <span className="mt-1.5 block pl-6 text-body-sm text-ink-muted">{r.text}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {invited && (
          <Alert tone="success">
            Invited {invited.email} as {invited.role === 'editor' ? 'an editor' : 'a viewer'}.
          </Alert>
        )}
      </form>

      {people.length > 0 && (
        <div className="mt-6 border-t border-line pt-5">
          <h3 className="text-label-md text-ink">
            People with access <span className="font-normal text-ink-muted">({people.length})</span>
          </h3>
          <ul className="mt-3 space-y-3">
            {people.map((m) => {
              const name = m.profiles?.display_name || m.profiles?.email || 'Unknown user';
              return (
                <li key={m.user_id} className="flex items-center gap-3">
                  <Avatar name={name} id={m.user_id} src={m.profiles?.avatar_url} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-label-md text-ink">
                      {name}
                      {m.user_id === currentUserId && <span className="font-normal text-ink-muted"> (you)</span>}
                    </p>
                    <p className="mt-1 truncate text-body-sm text-ink-muted">{m.profiles?.email}</p>
                  </div>
                  <span className="badge shrink-0">{capitalize(m.role)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Modal>
  );
}
