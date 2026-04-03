import { supabaseAdmin } from '../config/supabase.js';

export async function listFiles(req, res) {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('files')
      .select('*')
      .eq('workspace_id', id)
      .order('is_folder', { ascending: false })
      .order('name', { ascending: true });

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function getFile(req, res) {
  try {
    const { fileId } = req.params;

    const { data, error } = await supabaseAdmin
      .from('files')
      .select('*')
      .eq('id', fileId)
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function createFile(req, res) {
  try {
    const { id } = req.params;
    const { name, content, language, is_folder, parent_id } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'File name is required' });
    }

    const parentPath = parent_id
      ? (await supabaseAdmin.from('files').select('path').eq('id', parent_id).single()).data?.path || ''
      : '';
    const path = `${parentPath}/${name.trim()}`;

    const { data, error } = await supabaseAdmin
      .from('files')
      .insert({
        workspace_id: id,
        name: name.trim(),
        path,
        content: is_folder ? null : (content || ''),
        language: is_folder ? null : (language || 'plaintext'),
        is_folder: is_folder || false,
        parent_id: parent_id || null,
        created_by: req.user.id,
      })
      .select()
      .single();

    if (error) throw error;

    // Update workspace timestamp
    await supabaseAdmin
      .from('workspaces')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', id);

    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function updateFile(req, res) {
  try {
    const { fileId } = req.params;
    const { content } = req.body;

    const { data, error } = await supabaseAdmin
      .from('files')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', fileId)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function renameFile(req, res) {
  try {
    const { fileId } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'New name is required' });
    }

    const { data: file } = await supabaseAdmin
      .from('files')
      .select('path')
      .eq('id', fileId)
      .single();

    const pathParts = file.path.split('/');
    pathParts[pathParts.length - 1] = name.trim();
    const newPath = pathParts.join('/');

    const { data, error } = await supabaseAdmin
      .from('files')
      .update({ name: name.trim(), path: newPath })
      .eq('id', fileId)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function deleteFile(req, res) {
  try {
    const { fileId } = req.params;

    const { error } = await supabaseAdmin
      .from('files')
      .delete()
      .eq('id', fileId);

    if (error) throw error;

    res.json({ message: 'File deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}
