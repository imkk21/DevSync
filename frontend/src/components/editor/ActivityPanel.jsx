import { useEffect, useState } from 'react';
import { GoPulse } from 'react-icons/go';
import { supabase } from '../../lib/supabase';
import { timeAgo } from '../workspace/WorkspaceCard';
import Avatar from '../ui/Avatar';
import ToggleGroup from '../ui/ToggleGroup';

const p = (path) => path?.replace(/^\//, '') || 'a file';

// Plain-English line for an activity row. `nameOf(userId)` for people mentioned in details.
export function describe(a, nameOf) {
  const d = a.details || {};
  switch (a.action) {
    case 'file_created': return `created ${p(d.path)}`;
    case 'folder_created': return `created the folder ${p(d.path)}`;
    case 'file_deleted': return `deleted ${p(d.path)}`;
    case 'folder_deleted': return `deleted the folder ${p(d.path)}`;
    case 'file_renamed': return `renamed ${p(d.from)} to ${p(d.to)}`;
    case 'file_moved': return `moved ${p(d.from)} to ${p(d.to)}`;
    case 'file_restored': return `restored an earlier version of ${p(d.path)}`;
    case 'checkpoint': return `saved the checkpoint “${d.label}”`;
    case 'workspace_renamed': return `renamed the workspace to “${d.name}”`;
    case 'member_added': return `added ${d.email || nameOf(d.member)} as ${d.role === 'viewer' ? 'a viewer' : 'an editor'}`;
    case 'member_joined': return `joined${d.via === 'link' ? ' with an invite link' : ''}`;
    case 'member_removed': return `removed ${nameOf(d.member)}`;
    case 'member_left': return 'left the workspace';
    case 'role_changed': return `made ${nameOf(d.member)} ${d.role === 'viewer' ? 'a viewer' : 'an editor'}`;
    case 'ownership_transferred': return `made ${nameOf(d.member)} the owner`;
    case 'invite_sent': return `invited ${d.email}`;
    case 'invite_revoked': return `cancelled the invite for ${d.email}`;
    case 'invite_link_created': return `created an invite link for ${d.role === 'viewer' ? 'viewers' : 'editors'}`;
    case 'invite_link_revoked': return 'turned off an invite link';
    case 'public_link_on': return 'turned on the public link';
    case 'public_link_off': return 'turned off the public link';
    case 'classroom_on': return 'turned on classroom mode';
    case 'classroom_off': return 'turned off classroom mode';
    case 'student_joined': return 'joined the classroom';
    case 'interview_started': return 'started an interview';
    case 'interview_ended': return 'ended the interview';
    default: return a.action.replace(/_/g, ' ');
  }
}

// Who changed access: the audit log view
const ACCESS = /^(member_|role_|ownership_|invite_|public_link_|classroom_|student_)/;

export default function ActivityPanel({ workspaceId, people }) {
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState('all');
  const personOf = (id) => people.find((x) => x.id === id);
  const nameOf = (id) => personOf(id)?.name || 'someone';

  useEffect(() => {
    let alive = true;
    supabase
      .from('activity').select('*').eq('workspace_id', workspaceId).order('id', { ascending: false }).limit(100)
      .then(({ data }) => alive && setRows(data || []));
    const channel = supabase
      .channel(`activity:${workspaceId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity', filter: `workspace_id=eq.${workspaceId}` }, ({ new: row }) => {
        setRows((r) => (r && !r.some((x) => x.id === row.id) ? [row, ...r] : r));
      })
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [workspaceId]);

  const shown = (rows || []).filter((a) => filter === 'all' || ACCESS.test(a.action));

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-line pl-4 pr-2">
        <h2 className="text-label-md text-ink">Activity</h2>
        <ToggleGroup
          label="Show"
          size="sm"
          value={filter}
          onChange={setFilter}
          className="!h-7"
          options={[{ id: 'all', label: 'All' }, { id: 'access', label: 'Access' }]}
        />
      </div>
      <ol className="min-h-0 flex-1 overflow-y-auto p-3">
        {rows === null && <li className="text-body-sm text-ink-muted">Loading…</li>}
        {rows?.length === 0 && (
          <li className="px-2 py-8 text-center">
            <GoPulse size={20} className="mx-auto text-ink-subtle" aria-hidden="true" />
            <p className="mt-3 text-body-sm text-ink-muted">Changes to files and people will show up here.</p>
          </li>
        )}
        {shown.map((a) => {
          const person = personOf(a.user_id);
          return (
            <li key={a.id} className="flex gap-2.5 py-2">
              <Avatar name={person?.name || '?'} id={a.user_id || 'system'} src={person?.avatar_url} size={22} />
              <p className="min-w-0 flex-1 text-body-sm text-ink-muted">
                <span className="font-medium text-ink">{person?.name || (a.user_id ? 'A former member' : 'DevSync')}</span> {describe(a, nameOf)}
                <span className="block text-label-sm text-ink-subtle">{timeAgo(a.created_at)}</span>
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
