import { supabaseAdmin } from '../config/supabase.js';

export async function listWorkspaces(req, res) {
  try {
    const { data: memberRows } = await supabaseAdmin
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', req.user.id);

    const ids = memberRows?.map((m) => m.workspace_id) || [];

    if (ids.length === 0) {
      return res.json([]);
    }

    const { data, error } = await supabaseAdmin
      .from('workspaces')
      .select('*, workspace_members(count)')
      .in('id', ids)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function getWorkspace(req, res) {
  try {
    const { id } = req.params;

    // Check membership
    const { data: member } = await supabaseAdmin
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', id)
      .eq('user_id', req.user.id)
      .single();

    if (!member) {
      return res.status(403).json({ message: 'Not a member of this workspace' });
    }

    const { data, error } = await supabaseAdmin
      .from('workspaces')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    const { data: members } = await supabaseAdmin
      .from('workspace_members')
      .select('*, profiles(*)')
      .eq('workspace_id', id);

    res.json({ workspace: data, members, role: member.role });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function createWorkspace(req, res) {
  try {
    const { name, description, default_language } = req.body;

    if (!name || name.trim().length < 3) {
      return res.status(400).json({ message: 'Workspace name must be at least 3 characters' });
    }

    const { data, error } = await supabaseAdmin
      .from('workspaces')
      .insert({
        name: name.trim(),
        description: description?.trim(),
        default_language: default_language || 'javascript',
        owner_id: req.user.id,
      })
      .select()
      .single();

    if (error) throw error;

    // Add owner as member
    await supabaseAdmin.from('workspace_members').insert({
      workspace_id: data.id,
      user_id: req.user.id,
      role: 'owner',
    });

    // Create default main file
    function getExtension(lang) {
      const map = { javascript: 'js', typescript: 'ts', python: 'py', java: 'java', c: 'c', cpp: 'cpp', go: 'go', rust: 'rs', ruby: 'rb', php: 'php', csharp: 'cs' };
      return map[lang] || 'txt';
    }
    
    function getDefaultContent(lang) {
      const templates = {
        javascript: '// Welcome to DevSync!\nconsole.log("Hello, World!");\n',
        typescript: '// Welcome to DevSync!\nconsole.log("Hello, World!");\n',
        python: '# Welcome to DevSync!\nprint("Hello, World!")\n',
        java: '// Welcome to DevSync!\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}\n',
        c: '// Welcome to DevSync!\n#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}\n',
        cpp: '// Welcome to DevSync!\n#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}\n',
        go: '// Welcome to DevSync!\npackage main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n}\n',
        rust: '// Welcome to DevSync!\nfn main() {\n    println!("Hello, World!");\n}\n',
      };
      return templates[lang] || '// Welcome to DevSync!\n';
    }

    const lang = default_language || 'javascript';
    await supabaseAdmin.from('files').insert({
      workspace_id: data.id,
      name: `main.${getExtension(lang)}`,
      path: `/main.${getExtension(lang)}`,
      content: getDefaultContent(lang),
      language: lang,
      is_folder: false,
      created_by: req.user.id,
    });

    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function updateWorkspace(req, res) {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    // Check ownership
    const { data: member } = await supabaseAdmin
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', id)
      .eq('user_id', req.user.id)
      .single();

    if (!member || member.role !== 'owner') {
      return res.status(403).json({ message: 'Only the owner can update the workspace' });
    }

    const { data, error } = await supabaseAdmin
      .from('workspaces')
      .update({ name, description, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function deleteWorkspace(req, res) {
  try {
    const { id } = req.params;

    const { data: workspace } = await supabaseAdmin
      .from('workspaces')
      .select('owner_id')
      .eq('id', id)
      .single();

    if (!workspace || workspace.owner_id !== req.user.id) {
      return res.status(403).json({ message: 'Only the owner can delete the workspace' });
    }

    const { error } = await supabaseAdmin
      .from('workspaces')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ message: 'Workspace deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function inviteMember(req, res) {
  try {
    const { id } = req.params;
    const { email, role = 'editor' } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    if (!['editor', 'viewer'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    // Find user by email
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (profileErr) throw profileErr;

    if (!profile) {
      return res.status(404).json({ message: 'User not found with that email' });
    }

    // Check if already a member
    const { data: existing, error: existingErr } = await supabaseAdmin
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', id)
      .eq('user_id', profile.id)
      .maybeSingle();

    if (existingErr) throw existingErr;

    if (existing) {
      return res.status(409).json({ message: 'User is already a member' });
    }

    const { error } = await supabaseAdmin.from('workspace_members').insert({
      workspace_id: id,
      user_id: profile.id,
      role,
    });

    if (error) throw error;

    res.json({ message: 'Member invited successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function removeMember(req, res) {
  try {
    const { id, userId } = req.params;

    const { data: workspace } = await supabaseAdmin
      .from('workspaces')
      .select('owner_id')
      .eq('id', id)
      .single();

    if (!workspace || workspace.owner_id !== req.user.id) {
      return res.status(403).json({ message: 'Only the owner can remove members' });
    }

    if (userId === req.user.id) {
      return res.status(400).json({ message: 'Cannot remove yourself' });
    }

    const { error } = await supabaseAdmin
      .from('workspace_members')
      .delete()
      .eq('workspace_id', id)
      .eq('user_id', userId);

    if (error) throw error;

    res.json({ message: 'Member removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}
