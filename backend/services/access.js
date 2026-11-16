import { supabaseAdmin } from '../config/supabase.js';

// The caller's role in a workspace, or null if they aren't a member
export async function getRole(workspaceId, userId) {
  if (!workspaceId) return null;
  const { data } = await supabaseAdmin
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle();
  return data?.role ?? null;
}

export const canEdit = (role) => role === 'owner' || role === 'editor';

export async function isOwner(workspaceId, userId) {
  const { data } = await supabaseAdmin.from('workspaces').select('owner_id').eq('id', workspaceId).maybeSingle();
  return !!data && data.owner_id === userId;
}

// ponytail: fixed quotas; move to a plans table if tiers are ever needed
export const QUOTA = { ownedWorkspaces: 50, runsPerDay: 300, templateFiles: 100, templateBytes: 1_000_000 };

export async function ownedWorkspaceCount(userId) {
  const { count } = await supabaseAdmin.from('workspaces').select('id', { count: 'exact', head: true }).eq('owner_id', userId);
  return count ?? 0;
}
