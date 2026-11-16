import { randomBytes } from 'node:crypto';
import { supabaseAdmin } from '../config/supabase.js';
import { onMemberRemoved, onRoleChanged, readFileContent, broadcastToWorkspace } from '../collab.js';
import { getRole, isOwner, QUOTA, ownedWorkspaceCount } from '../services/access.js';
import { logActivity, notify, sendEmail, appUrl, displayName } from '../services/events.js';

const newToken = () => randomBytes(18).toString('base64url');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EXTENSIONS = { javascript: 'js', typescript: 'ts', python: 'py', java: 'java', c: 'c', cpp: 'cpp', go: 'go', rust: 'rs', ruby: 'rb', php: 'php', csharp: 'cs' };
const STARTERS = {
  javascript: '// Welcome to DevSync!\nconsole.log("Hello, World!");\n',
  typescript: '// Welcome to DevSync!\nconsole.log("Hello, World!");\n',
  python: '# Welcome to DevSync!\nprint("Hello, World!")\n',
  java: '// Welcome to DevSync!\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}\n',
  c: '// Welcome to DevSync!\n#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}\n',
  cpp: '// Welcome to DevSync!\n#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}\n',
  go: '// Welcome to DevSync!\npackage main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n}\n',
  rust: '// Welcome to DevSync!\nfn main() {\n    println!("Hello, World!");\n}\n',
};

// Insert a file tree from paths ("src/app.py"); folders are created from the paths.
// entries: [{ path, content, language, is_folder? }]. Returns Map(path -> new file id).
export async function insertTree(workspaceId, userId, entries) {
  const rows = new Map();
  for (const e of entries) {
    const parts = String(e.path).split('/').filter(Boolean);
    if (parts.length === 0) continue;
    for (let i = 1; i < parts.length; i++) {
      const path = `/${parts.slice(0, i).join('/')}`;
      if (!rows.has(path)) rows.set(path, { path, name: parts[i - 1], is_folder: true, depth: i });
    }
    const path = `/${parts.join('/')}`;
    rows.set(path, {
      path, name: parts.at(-1), depth: parts.length, is_folder: !!e.is_folder,
      content: e.is_folder ? null : String(e.content ?? ''), language: e.is_folder ? null : e.language || 'plaintext',
    });
  }

  const ids = new Map();
  const depths = [...new Set([...rows.values()].map((r) => r.depth))].sort((a, b) => a - b);
  for (const depth of depths) {
    const batch = [...rows.values()].filter((r) => r.depth === depth).map(({ depth: _, ...r }) => ({
      ...r,
      workspace_id: workspaceId,
      created_by: userId,
      parent_id: ids.get(r.path.slice(0, r.path.lastIndexOf('/'))) ?? null,
    }));
    const { data, error } = await supabaseAdmin.from('files').insert(batch).select('id, path');
    if (error) throw error;
    for (const r of data) ids.set(r.path, r.id);
  }
  return ids;
}

// Create a workspace owned by `userId` with its files and tests: { files: [...], tests: [{ path, input, expected_output }] }
export async function createWithFiles(userId, fields, files, tests = []) {
  const { data: workspace, error } = await supabaseAdmin.from('workspaces').insert({ ...fields, owner_id: userId }).select().single();
  if (error) throw error;
  await supabaseAdmin.from('workspace_members').insert({ workspace_id: workspace.id, user_id: userId, role: 'owner' });
  const ids = await insertTree(workspace.id, userId, files);
  const testRows = tests
    .map((t) => ({ file_id: ids.get(`/${String(t.path).replace(/^\/+/, '')}`), workspace_id: workspace.id, input: t.input || '', expected_output: t.expected_output || '' }))
    .filter((t) => t.file_id);
  if (testRows.length) await supabaseAdmin.from('test_cases').insert(testRows);
  return workspace;
}

// All files of a workspace with their latest text, plus tests keyed by path
export async function readTree(workspaceId) {
  const { data: files, error } = await supabaseAdmin
    .from('files').select('id, path, is_folder, language, content').eq('workspace_id', workspaceId);
  if (error) throw error;
  const withContent = await Promise.all(files.map(async (f) => ({ ...f, content: f.is_folder ? null : await readFileContent(f.id, f.content) })));
  const pathOf = new Map(files.map((f) => [f.id, f.path]));
  const { data: tests } = await supabaseAdmin.from('test_cases').select('file_id, input, expected_output').eq('workspace_id', workspaceId);
  return {
    files: withContent,
    tests: (tests || []).map((t) => ({ path: pathOf.get(t.file_id), input: t.input, expected_output: t.expected_output })).filter((t) => t.path),
  };
}

export async function quotaError(userId) {
  return (await ownedWorkspaceCount(userId)) >= QUOTA.ownedWorkspaces
    ? `You can own up to ${QUOTA.ownedWorkspaces} workspaces. Delete one to make room.`
    : null;
}

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
    const role = await getRole(id, req.user.id);
    if (!role) return res.status(403).json({ message: 'Not a member of this workspace' });

    const { data, error } = await supabaseAdmin.from('workspaces').select('*').eq('id', id).single();
    if (error) throw error;

    const { data: members } = await supabaseAdmin
      .from('workspace_members')
      .select('*, profiles(*)')
      .eq('workspace_id', id);

    res.json({ workspace: data, members, role });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Body: name, description, default_language, and optionally files/tests from a template
export async function createWorkspace(req, res) {
  try {
    const { name, description, default_language, files, tests } = req.body;

    if (!name || name.trim().length < 3) {
      return res.status(400).json({ message: 'Workspace name must be at least 3 characters' });
    }
    const quota = await quotaError(req.user.id);
    if (quota) return res.status(403).json({ message: quota });

    const lang = default_language || 'javascript';
    let entries = [{ path: `main.${EXTENSIONS[lang] || 'txt'}`, content: STARTERS[lang] || '// Welcome to DevSync!\n', language: lang }];
    if (Array.isArray(files) && files.length) {
      const bytes = files.reduce((n, f) => n + String(f.content ?? '').length, 0);
      if (files.length > QUOTA.templateFiles || bytes > QUOTA.templateBytes) {
        return res.status(413).json({ message: 'That template is too large' });
      }
      entries = files;
    }

    const workspace = await createWithFiles(
      req.user.id,
      { name: name.trim().slice(0, 50), description: description?.trim().slice(0, 200), default_language: lang },
      entries,
      Array.isArray(tests) ? tests.slice(0, 50) : [],
    );
    res.status(201).json(workspace);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Owner settings: name, description, classroom mode, interview mode
export async function updateWorkspace(req, res) {
  try {
    const { id } = req.params;
    const { name, description, is_classroom, interview } = req.body;
    if (!(await isOwner(id, req.user.id))) return res.status(403).json({ message: 'Only the owner can update the workspace' });

    const patch = { updated_at: new Date().toISOString() };
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 3 || name.trim().length > 50) {
        return res.status(400).json({ message: 'Use 3 to 50 characters for the name' });
      }
      patch.name = name.trim();
    }
    if (description !== undefined) patch.description = String(description ?? '').trim().slice(0, 200);
    if (is_classroom !== undefined) patch.is_classroom = !!is_classroom;
    if (interview !== undefined) patch.interview_started_at = interview ? new Date().toISOString() : null;

    const { data, error } = await supabaseAdmin.from('workspaces').update(patch).eq('id', id).select().single();
    if (error) throw error;

    if (patch.name) await logActivity(id, req.user.id, 'workspace_renamed', { name: patch.name });
    if (is_classroom !== undefined) await logActivity(id, req.user.id, is_classroom ? 'classroom_on' : 'classroom_off');
    if (interview !== undefined) await logActivity(id, req.user.id, interview ? 'interview_started' : 'interview_ended');
    broadcastToWorkspace(id, 'workspace:updated', data);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function deleteWorkspace(req, res) {
  try {
    const { id } = req.params;

    if (!(await isOwner(id, req.user.id))) {
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

// A personal copy with every file and test. Any member can duplicate.
export async function duplicateWorkspace(req, res) {
  try {
    const { id } = req.params;
    if (!(await getRole(id, req.user.id))) return res.status(403).json({ message: 'Not a member of this workspace' });
    const quota = await quotaError(req.user.id);
    if (quota) return res.status(403).json({ message: quota });

    const { data: source } = await supabaseAdmin.from('workspaces').select('name, description, default_language').eq('id', id).single();
    const { files, tests } = await readTree(id);
    const copy = await createWithFiles(
      req.user.id,
      { name: `${source.name} (copy)`.slice(0, 50), description: source.description, default_language: source.default_language },
      files,
      tests,
    );
    res.status(201).json(copy);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Anyone with the link can view (read-only, no sign-in). enabled: true creates a new link.
export async function setPublicLink(req, res) {
  try {
    const { id } = req.params;
    if (!(await isOwner(id, req.user.id))) return res.status(403).json({ message: 'Only the owner can share publicly' });
    const public_token = req.body.enabled ? newToken() : null;
    const { data, error } = await supabaseAdmin.from('workspaces').update({ public_token }).eq('id', id).select().single();
    if (error) throw error;
    await logActivity(id, req.user.id, public_token ? 'public_link_on' : 'public_link_off');
    broadcastToWorkspace(id, 'workspace:updated', data);
    res.json({ public_token });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// No auth: the read-only snapshot behind a public link
export async function getPublicWorkspace(req, res) {
  try {
    const { token } = req.params;
    if (!token || token.length < 16) return res.status(404).json({ message: 'Link not found' });
    const { data: workspace } = await supabaseAdmin
      .from('workspaces').select('id, name, description, default_language, updated_at, owner_id').eq('public_token', token).maybeSingle();
    if (!workspace) return res.status(404).json({ message: 'This link is no longer shared' });
    const { data: files, error } = await supabaseAdmin
      .from('files').select('id, name, path, is_folder, parent_id, language, content').eq('workspace_id', workspace.id);
    if (error) throw error;
    // The id lets the live view join the workspace as a read-only spectator
    res.json({ workspace, files });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Invite by email. People without an account get a pending invite that's claimed when they sign in.
export async function inviteMember(req, res) {
  try {
    const { id } = req.params;
    const { role = 'editor' } = req.body;
    const email = String(req.body.email || '').trim().toLowerCase();

    if (!EMAIL_RE.test(email)) return res.status(400).json({ message: 'Enter a valid email address' });
    if (!['editor', 'viewer'].includes(role)) return res.status(400).json({ message: 'Invalid role' });
    if (!(await isOwner(id, req.user.id))) return res.status(403).json({ message: 'Only the owner can invite members' });

    const [{ data: workspace }, inviter] = await Promise.all([
      supabaseAdmin.from('workspaces').select('name').eq('id', id).single(),
      displayName(req.user.id),
    ]);
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles').select('id').eq('email', email).maybeSingle();
    if (profileErr) throw profileErr;

    if (!profile) {
      const { data: existingInvite } = await supabaseAdmin
        .from('workspace_invites').select('id').eq('workspace_id', id).eq('email', email).maybeSingle();
      if (existingInvite) await supabaseAdmin.from('workspace_invites').update({ role }).eq('id', existingInvite.id);
      else await supabaseAdmin.from('workspace_invites').insert({ workspace_id: id, email, role, created_by: req.user.id });
      await logActivity(id, req.user.id, 'invite_sent', { email, role });
      const emailed = await sendEmail({
        to: email,
        subject: `${inviter} invited you to ${workspace.name} on DevSync`,
        text: `${inviter} invited you to code together in "${workspace.name}". Sign in with this email address to join.`,
        link: appUrl('/login'),
      });
      return res.json({
        pending: true,
        message: emailed
          ? `Invite emailed to ${email}. They'll join when they sign in.`
          : `${email} doesn't have an account yet. They'll join automatically when they sign in with that email.`,
      });
    }

    const { data: existing, error: existingErr } = await supabaseAdmin
      .from('workspace_members').select('id').eq('workspace_id', id).eq('user_id', profile.id).maybeSingle();
    if (existingErr) throw existingErr;
    if (existing) return res.status(409).json({ message: 'User is already a member' });

    const { error } = await supabaseAdmin.from('workspace_members').insert({ workspace_id: id, user_id: profile.id, role });
    if (error) throw error;

    await Promise.all([
      logActivity(id, req.user.id, 'member_added', { member: profile.id, email, role }),
      notify({ userId: profile.id, actorId: req.user.id, workspaceId: id, type: 'invite', body: `added you to ${workspace.name}`, link: `/editor/${id}` }),
      sendEmail({
        to: email,
        subject: `${inviter} added you to ${workspace.name} on DevSync`,
        text: `${inviter} added you to "${workspace.name}" as ${role === 'editor' ? 'an editor' : 'a viewer'}.`,
        link: appUrl(`/editor/${id}`),
      }),
    ]);
    res.json({ message: 'Member invited successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function removeMember(req, res) {
  try {
    const { id, userId } = req.params;
    if (!(await isOwner(id, req.user.id))) return res.status(403).json({ message: 'Only the owner can remove members' });
    if (userId === req.user.id) return res.status(400).json({ message: 'Cannot remove yourself' });

    const { error } = await supabaseAdmin
      .from('workspace_members')
      .delete()
      .eq('workspace_id', id)
      .eq('user_id', userId);

    if (error) throw error;

    await onMemberRemoved(id, userId);
    await logActivity(id, req.user.id, 'member_removed', { member: userId });
    res.json({ message: 'Member removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function updateMemberRole(req, res) {
  try {
    const { id, userId } = req.params;
    const { role } = req.body;

    if (!['editor', 'viewer'].includes(role)) return res.status(400).json({ message: 'Invalid role' });
    if (!(await isOwner(id, req.user.id))) return res.status(403).json({ message: 'Only the owner can change roles' });
    if (userId === req.user.id) return res.status(400).json({ message: "You can't change your own role" });

    const { data, error } = await supabaseAdmin
      .from('workspace_members')
      .update({ role })
      .eq('workspace_id', id)
      .eq('user_id', userId)
      .select('id');

    if (error) throw error;
    if (!data.length) return res.status(404).json({ message: 'Not a member of this workspace' });

    await onRoleChanged(id, userId, role);
    await logActivity(id, req.user.id, 'role_changed', { member: userId, role });
    res.json({ message: 'Role updated' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function leaveWorkspace(req, res) {
  try {
    const { id } = req.params;

    if (await isOwner(id, req.user.id)) {
      return res.status(400).json({ message: 'Transfer ownership before leaving your own workspace' });
    }

    const { error } = await supabaseAdmin
      .from('workspace_members')
      .delete()
      .eq('workspace_id', id)
      .eq('user_id', req.user.id);

    if (error) throw error;

    await onMemberRemoved(id, req.user.id);
    await logActivity(id, req.user.id, 'member_left');
    res.json({ message: 'Left workspace' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function transferOwnership(req, res) {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!(await isOwner(id, req.user.id))) return res.status(403).json({ message: 'Only the owner can transfer ownership' });
    if (!userId || userId === req.user.id) return res.status(400).json({ message: 'Pick another member' });
    if (!(await getRole(id, userId))) return res.status(404).json({ message: 'Not a member of this workspace' });

    // ponytail: three writes, not one transaction. Move to a Postgres function if a half-done transfer ever shows up.
    const steps = [
      supabaseAdmin.from('workspaces').update({ owner_id: userId }).eq('id', id),
      supabaseAdmin.from('workspace_members').update({ role: 'owner' }).eq('workspace_id', id).eq('user_id', userId),
      supabaseAdmin.from('workspace_members').update({ role: 'editor' }).eq('workspace_id', id).eq('user_id', req.user.id),
    ];
    for (const step of steps) {
      const { error } = await step;
      if (error) throw error;
    }

    await onRoleChanged(id, userId, 'owner');
    await onRoleChanged(id, req.user.id, 'editor');
    await logActivity(id, req.user.id, 'ownership_transferred', { member: userId });
    res.json({ message: 'Ownership transferred' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// ---------- Invite links ----------

// Owner: the link for a role (created on first use) and pending email invites
export async function listInvites(req, res) {
  try {
    const { id } = req.params;
    if (!(await isOwner(id, req.user.id))) return res.status(403).json({ message: 'Only the owner can manage invites' });
    const { data, error } = await supabaseAdmin
      .from('workspace_invites').select('id, token, email, role, created_at').eq('workspace_id', id).order('created_at');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function createInviteLink(req, res) {
  try {
    const { id } = req.params;
    const { role = 'editor' } = req.body;
    if (!['editor', 'viewer'].includes(role)) return res.status(400).json({ message: 'Invalid role' });
    if (!(await isOwner(id, req.user.id))) return res.status(403).json({ message: 'Only the owner can create invite links' });
    const { data, error } = await supabaseAdmin
      .from('workspace_invites').insert({ workspace_id: id, token: newToken(), role, created_by: req.user.id })
      .select('id, token, email, role, created_at').single();
    if (error) throw error;
    await logActivity(id, req.user.id, 'invite_link_created', { role });
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function revokeInvite(req, res) {
  try {
    const { id, inviteId } = req.params;
    if (!(await isOwner(id, req.user.id))) return res.status(403).json({ message: 'Only the owner can revoke invites' });
    const { data, error } = await supabaseAdmin
      .from('workspace_invites').delete().eq('id', inviteId).eq('workspace_id', id).select('email, token');
    if (error) throw error;
    if (data.length) await logActivity(id, req.user.id, data[0].email ? 'invite_revoked' : 'invite_link_revoked', data[0].email ? { email: data[0].email } : {});
    res.json({ message: 'Invite revoked' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Classroom: each student gets their own copy, with the teacher (owner) as an editor
async function classroomCopy(classroom, userId) {
  const { data: existing } = await supabaseAdmin
    .from('workspaces').select('id').eq('classroom_id', classroom.id).eq('owner_id', userId).maybeSingle();
  if (existing) return existing.id;
  const quota = await quotaError(userId);
  if (quota) throw Object.assign(new Error(quota), { status: 403 });

  const { files, tests } = await readTree(classroom.id);
  const copy = await createWithFiles(
    userId,
    { name: classroom.name, description: classroom.description, default_language: classroom.default_language, classroom_id: classroom.id },
    files,
    tests,
  );
  await supabaseAdmin.from('workspace_members').insert({ workspace_id: copy.id, user_id: classroom.owner_id, role: 'editor' });
  await logActivity(classroom.id, userId, 'student_joined', { copy: copy.id });
  return copy.id;
}

// What an invite link points to, for the page that asks before joining
export async function previewInvite(req, res) {
  try {
    const { data: invite } = await supabaseAdmin
      .from('workspace_invites').select('role, workspaces(id, name, description, is_classroom, owner_id)').eq('token', req.params.token).maybeSingle();
    if (!invite?.workspaces) return res.status(404).json({ message: 'This invite link is invalid or was revoked' });
    const w = invite.workspaces;
    res.json({
      role: invite.role,
      workspace: { name: w.name, description: w.description, is_classroom: w.is_classroom },
      owner: await displayName(w.owner_id),
      member: !!(await getRole(w.id, req.user.id)),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function acceptInvite(req, res) {
  try {
    const { data: invite } = await supabaseAdmin
      .from('workspace_invites').select('role, workspaces(*)').eq('token', req.params.token).maybeSingle();
    const workspace = invite?.workspaces;
    if (!workspace) return res.status(404).json({ message: 'This invite link is invalid or was revoked' });

    if (await getRole(workspace.id, req.user.id)) return res.json({ workspaceId: workspace.id });
    if (workspace.is_classroom) return res.json({ workspaceId: await classroomCopy(workspace, req.user.id) });

    const { error } = await supabaseAdmin.from('workspace_members').insert({ workspace_id: workspace.id, user_id: req.user.id, role: invite.role });
    if (error && error.code !== '23505') throw error; // 23505: joined twice at once
    await logActivity(workspace.id, req.user.id, 'member_joined', { role: invite.role, via: 'link' });
    res.json({ workspaceId: workspace.id });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
}

// Email invites waiting for this person, turned into memberships. Called after sign-in.
export async function claimInvites(req, res) {
  try {
    const email = req.user.email?.toLowerCase();
    if (!email) return res.json({ joined: [] });
    const { data: invites, error } = await supabaseAdmin
      .from('workspace_invites').select('id, workspace_id, role').eq('email', email);
    if (error) throw error;

    const joined = [];
    for (const invite of invites) {
      const { error: insertErr } = await supabaseAdmin
        .from('workspace_members').insert({ workspace_id: invite.workspace_id, user_id: req.user.id, role: invite.role });
      if (insertErr && insertErr.code !== '23505') continue;
      await supabaseAdmin.from('workspace_invites').delete().eq('id', invite.id);
      await logActivity(invite.workspace_id, req.user.id, 'member_joined', { role: invite.role, via: 'email' });
      joined.push(invite.workspace_id);
    }
    res.json({ joined });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}
