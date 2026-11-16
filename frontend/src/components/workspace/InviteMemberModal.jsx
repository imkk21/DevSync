import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GoCopy, GoLink, GoMail, GoPersonFill, GoTrash } from 'react-icons/go';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Alert from '../ui/Alert';
import Avatar from '../ui/Avatar';
import Switch from '../ui/Switch';
import DropdownMenu from '../ui/DropdownMenu';
import useWorkspaceStore from '../../store/workspaceStore';
import { supabase } from '../../lib/supabase';
import { toast } from '../../store/toastStore';
import { timeAgo } from './WorkspaceCard';

const copy = async (text, what) => {
  try {
    await navigator.clipboard.writeText(text);
    toast(`${what} copied`, { tone: 'success' });
  } catch {
    toast(`Couldn't copy. Here it is: ${text}`, { duration: 10000 });
  }
};

function Section({ title, hint, children }) {
  return (
    <section className="mt-6 border-t border-line pt-5">
      <h3 className="text-label-md text-ink">{title}</h3>
      {hint && <p className="mt-1 text-body-sm text-ink-muted">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

// Links, pending email invites, the public link and classroom mode
function MoreSharing({ workspace, reloadKey }) {
  const { listInvites, createInviteLink, revokeInvite, setPublicLink, updateWorkspace } = useWorkspaceStore();
  const [invites, setInvites] = useState([]);
  const [linkRole, setLinkRole] = useState('editor');
  const [busy, setBusy] = useState(false);
  const [students, setStudents] = useState([]);
  const origin = window.location.origin;

  useEffect(() => {
    listInvites(workspace.id).then(setInvites).catch(() => setInvites([]));
  }, [workspace.id, reloadKey]);

  useEffect(() => {
    if (!workspace.is_classroom) return;
    supabase
      .from('workspaces').select('id, updated_at, owner_id, profiles(display_name, email)').eq('classroom_id', workspace.id).order('updated_at', { ascending: false })
      .then(({ data }) => setStudents(data || []));
  }, [workspace.id, workspace.is_classroom]);

  const run = async (fn) => {
    setBusy(true);
    try { await fn(); } catch (err) { toast(err.message, { tone: 'error' }); } finally { setBusy(false); }
  };
  const links = invites.filter((i) => i.token);
  const pending = invites.filter((i) => i.email);

  return (
    <>
      <Section
        title="Invite link"
        hint={workspace.is_classroom ? 'Each student who opens it gets their own copy of this workspace.' : 'Anyone with a link can join after signing in.'}
      >
        <div className="flex gap-2">
          <label htmlFor="link-role" className="sr-only">Role for new link</label>
          <select
            id="link-role"
            value={linkRole}
            onChange={(e) => setLinkRole(e.target.value)}
            className="h-8 cursor-pointer rounded-md border border-line-strong bg-canvas pl-2 pr-7 text-label-md text-ink hover:border-line-emphasis"
          >
            <option value="editor">Can edit</option>
            <option value="viewer">Can view</option>
          </select>
          <Button
            size="sm"
            variant="secondary"
            loading={busy}
            onClick={() => run(async () => {
              const invite = await createInviteLink(workspace.id, linkRole);
              setInvites((list) => [...list, invite]);
              copy(`${origin}/invite/${invite.token}`, 'Invite link');
            })}
          >
            <GoLink size={14} /> Create link
          </Button>
        </div>
        {links.length > 0 && (
          <ul className="mt-3 space-y-2">
            {links.map((i) => (
              <li key={i.id} className="flex items-center gap-2 rounded-md border border-line px-3 py-2">
                <span className="min-w-0 flex-1 truncate font-mono text-code-sm text-ink-muted">{origin}/invite/{i.token}</span>
                <span className="badge shrink-0">{i.role === 'editor' ? 'Can edit' : 'Can view'}</span>
                <button type="button" onClick={() => copy(`${origin}/invite/${i.token}`, 'Invite link')} className="icon-btn h-7 w-7" aria-label="Copy link" title="Copy link">
                  <GoCopy size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => run(async () => {
                    await revokeInvite(workspace.id, i.id);
                    setInvites((list) => list.filter((x) => x.id !== i.id));
                  })}
                  className="icon-btn h-7 w-7"
                  aria-label="Turn off this link"
                  title="Turn off this link"
                >
                  <GoTrash size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {pending.length > 0 && (
        <Section title="Waiting to join" hint="They'll join automatically the first time they sign in with that email.">
          <ul className="space-y-2">
            {pending.map((i) => (
              <li key={i.id} className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-canvas-muted text-ink-muted"><GoMail size={14} aria-hidden="true" /></span>
                <span className="min-w-0 flex-1 truncate text-body-sm text-ink">{i.email}</span>
                <span className="badge shrink-0">{i.role === 'editor' ? 'Editor' : 'Viewer'}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => run(async () => {
                    await revokeInvite(workspace.id, i.id);
                    setInvites((list) => list.filter((x) => x.id !== i.id));
                  })}
                >
                  Cancel
                </Button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Public link">
        <Switch
          label="Anyone with the link can view"
          hint="A read-only snapshot. No sign-in needed. Turning it off and on makes a new link."
          checked={!!workspace.public_token}
          disabled={busy}
          onChange={(on) => run(async () => {
            const { token, error } = await setPublicLink(workspace.id, on);
            if (error) throw error;
            if (token) copy(`${origin}/p/${token}`, 'Public link');
          })}
        />
        {workspace.public_token && (
          <>
            <div className="mt-3 flex items-center gap-2 rounded-md border border-line px-3 py-2">
              <span className="min-w-0 flex-1 truncate font-mono text-code-sm text-ink-muted">{origin}/p/{workspace.public_token}</span>
              <button type="button" onClick={() => copy(`${origin}/p/${workspace.public_token}`, 'Public link')} className="icon-btn h-7 w-7" aria-label="Copy public link" title="Copy">
                <GoCopy size={14} />
              </button>
            </div>
            <p className="mt-2 text-body-sm text-ink-muted">
              Viewers watch you code live, chat with you and can suggest changes. Put a live, runnable copy on any website:
            </p>
            <div className="mt-2 flex items-center gap-2 rounded-md border border-line px-3 py-2">
              <span className="min-w-0 flex-1 truncate font-mono text-code-sm text-ink-muted">{`<iframe src="${origin}/embed/${workspace.public_token}" …>`}</span>
              <button
                type="button"
                onClick={() => copy(`<iframe src="${origin}/embed/${workspace.public_token}" width="800" height="480" style="border:1px solid #E5E7EB;border-radius:8px"></iframe>`, 'Embed code')}
                className="icon-btn h-7 w-7"
                aria-label="Copy embed code"
                title="Copy embed code"
              >
                <GoCopy size={14} />
              </button>
            </div>
          </>
        )}
      </Section>

      <Section title="Classroom">
        <Switch
          label="Give each student their own copy"
          hint="Invite links then make a personal copy for whoever opens them, with you added so you can help."
          checked={!!workspace.is_classroom}
          disabled={busy}
          onChange={(on) => run(async () => {
            const { error } = await updateWorkspace(workspace.id, { is_classroom: on });
            if (error) throw error;
          })}
        />
        {workspace.is_classroom && (
          <ul className="mt-3 space-y-2">
            {students.length === 0 && <li className="text-body-sm text-ink-muted">No students yet. Share an invite link to start.</li>}
            {students.map((s) => {
              const name = s.profiles?.display_name || s.profiles?.email || 'Student';
              return (
                <li key={s.id} className="flex items-center gap-3">
                  <Avatar name={name} id={s.owner_id} size={28} />
                  <span className="min-w-0 flex-1 truncate text-body-sm text-ink">{name}</span>
                  <span className="shrink-0 text-label-sm text-ink-subtle">Updated {timeAgo(s.updated_at)}</span>
                  <Link to={`/editor/${s.id}`} className="btn btn-sm btn-secondary shrink-0">Open</Link>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </>
  );
}

const FORM_ID = 'invite-member-form';
const ROLES = [
  { id: 'editor', label: 'Editor', text: 'Can edit and run code' },
  { id: 'viewer', label: 'Viewer', text: 'Can view and run code' },
];
const ROLE_ORDER = { owner: 0, editor: 1, viewer: 2 };
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// One person in the access list. Owners can change roles, remove people or hand over ownership.
function MemberRow({ member, workspaceId, isSelf, onError }) {
  const { updateMemberRole, removeMember, transferOwnership } = useWorkspaceStore();
  const [confirm, setConfirm] = useState(null); // 'remove' | 'transfer'
  const [busy, setBusy] = useState(false);
  const name = member.profiles?.display_name || member.profiles?.email || 'Unknown user';
  const manageable = !isSelf && member.role !== 'owner';

  const run = async (action) => {
    setBusy(true);
    onError('');
    const { error } = await action();
    setBusy(false);
    setConfirm(null);
    if (error) onError(error.message);
  };

  return (
    <li className="flex min-h-[40px] items-center gap-3">
      <Avatar name={name} id={member.user_id} src={member.profiles?.avatar_url} size={32} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-label-md text-ink">
          {name}
          {isSelf && <span className="font-normal text-ink-muted"> (you)</span>}
        </p>
        <p className="mt-1 truncate text-body-sm text-ink-muted">{member.profiles?.email}</p>
      </div>
      {confirm ? (
        <div className="flex shrink-0 items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => setConfirm(null)} disabled={busy}>Cancel</Button>
          <Button
            size="sm"
            variant={confirm === 'remove' ? 'danger' : 'primary'}
            loading={busy}
            onClick={() => run(() => (confirm === 'remove'
              ? removeMember(workspaceId, member.user_id)
              : transferOwnership(workspaceId, member.user_id)))}
          >
            {confirm === 'remove' ? 'Remove' : 'Make owner'}
          </Button>
        </div>
      ) : manageable ? (
        <div className="flex shrink-0 items-center gap-1">
          <label className="sr-only" htmlFor={`role-${member.user_id}`}>Role for {name}</label>
          <select
            id={`role-${member.user_id}`}
            value={member.role}
            disabled={busy}
            onChange={(e) => run(() => updateMemberRole(workspaceId, member.user_id, e.target.value))}
            className="h-8 cursor-pointer rounded-md border border-line-strong bg-canvas pl-2 pr-7 text-label-md text-ink hover:border-line-emphasis disabled:opacity-50"
          >
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
          <DropdownMenu
            label={`More options for ${name}`}
            buttonClassName="h-8 w-8"
            items={[
              { label: 'Make owner', icon: GoPersonFill, onSelect: () => setConfirm('transfer') },
              { label: 'Remove access', icon: GoTrash, danger: true, onSelect: () => setConfirm('remove') },
            ]}
          />
        </div>
      ) : (
        <span className="badge shrink-0">{capitalize(member.role)}</span>
      )}
    </li>
  );
}

export default function InviteMemberModal({ isOpen, onClose, onInvite, members = [], currentUserId, workspaceId, workspace }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('editor');
  const [error, setError] = useState('');
  const [invited, setInvited] = useState(null); // { email, role } or { message } for a pending invite
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState('');

  const close = () => {
    setListError('');
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
    setInvited(result?.data?.pending ? { message: result.data.message } : { email: value, role });
    setEmail('');
  };

  const people = [...members].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Share workspace"
      description="Invite anyone by email. People without an account join when they first sign in."
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
          <Alert tone={invited.message ? 'info' : 'success'}>
            {invited.message || `Invited ${invited.email} as ${invited.role === 'editor' ? 'an editor' : 'a viewer'}.`}
          </Alert>
        )}
      </form>

      {people.length > 0 && (
        <div className="mt-6 border-t border-line pt-5">
          <h3 className="text-label-md text-ink">
            People with access <span className="font-normal text-ink-muted">({people.length})</span>
          </h3>
          {listError && <Alert className="mt-3">{listError}</Alert>}
          <ul className="mt-3 space-y-3">
            {people.map((m) => (
              <MemberRow
                key={m.user_id}
                member={m}
                workspaceId={workspaceId}
                isSelf={m.user_id === currentUserId}
                onError={setListError}
              />
            ))}
          </ul>
        </div>
      )}

      {workspace && isOpen && <MoreSharing workspace={workspace} reloadKey={invited} />}
    </Modal>
  );
}
