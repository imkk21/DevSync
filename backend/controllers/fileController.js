import { supabaseAdmin } from '../config/supabase.js';
import { createVersion, replaceFileContent, readFileContent } from '../collab.js';
import { getRole, canEdit } from '../services/access.js';
import { logActivity } from '../services/events.js';

// Put a file back to an earlier version. The current text is kept as a version first,
// so a restore can itself be undone.
export async function restoreVersion(req, res) {
  try {
    const { id } = req.params;
    const { versionId } = req.body;
    const { data: version } = await supabaseAdmin
      .from('file_versions').select('content, workspace_id, created_at, label, files(path)').eq('id', versionId).eq('file_id', id).maybeSingle();
    if (!version) return res.status(404).json({ message: 'Version not found' });
    if (!canEdit(await getRole(version.workspace_id, req.user.id))) return res.status(403).json({ message: 'Only editors can restore versions' });

    await createVersion(id, version.workspace_id, { label: 'Before restore', userId: req.user.id });
    await replaceFileContent(id, version.workspace_id, version.content);
    await logActivity(version.workspace_id, req.user.id, 'file_restored', { path: version.files?.path, from: version.label || version.created_at });
    res.json({ message: 'Restored' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// A named point in history for every file in the workspace
export async function createCheckpoint(req, res) {
  try {
    const { id } = req.params;
    const label = String(req.body.label || '').trim().slice(0, 80) || 'Checkpoint';
    if (!canEdit(await getRole(id, req.user.id))) return res.status(403).json({ message: 'Only editors can save checkpoints' });

    const { data: files, error } = await supabaseAdmin.from('files').select('id, content').eq('workspace_id', id).eq('is_folder', false);
    if (error) throw error;
    const rows = await Promise.all(files.map(async (f) => ({
      file_id: f.id, workspace_id: id, label, created_by: req.user.id, content: await readFileContent(f.id, f.content),
    })));
    if (rows.length) {
      const { error: insertErr } = await supabaseAdmin.from('file_versions').insert(rows);
      if (insertErr) throw insertErr;
    }
    await logActivity(id, req.user.id, 'checkpoint', { label, files: files.length });
    res.status(201).json({ label, files: files.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Deletes the account. Workspaces you own go with it; your edits elsewhere stay.
export async function deleteAccount(req, res) {
  try {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(req.user.id);
    if (error) throw error;
    res.json({ message: 'Account deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}
