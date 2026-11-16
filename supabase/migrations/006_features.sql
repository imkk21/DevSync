-- ============================================================
-- 006: Everything the editor features need: file history, replay, activity,
-- invites, public links, comments, chat, notifications, test cases, quotas.
-- Run in the Supabase SQL Editor after 005. Safe to re-run.
-- Tables without client policies are written only by the backend (service role).
-- ============================================================

-- ---------- Workspaces ----------
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS public_token TEXT UNIQUE; -- read-only public link when set
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS is_classroom BOOLEAN NOT NULL DEFAULT FALSE; -- invite links hand out personal copies
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS classroom_id UUID REFERENCES workspaces(id) ON DELETE SET NULL; -- the classroom a copy came from
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS interview_started_at TIMESTAMPTZ; -- interview mode is on while set
CREATE INDEX IF NOT EXISTS idx_workspaces_classroom ON workspaces(classroom_id);

-- Per-person: pin and archive are your own view of the dashboard
ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE;
REVOKE UPDATE ON workspace_members FROM anon, authenticated;
GRANT UPDATE (pinned, archived) ON workspace_members TO authenticated;
DROP POLICY IF EXISTS "Members update own prefs" ON workspace_members;
CREATE POLICY "Members update own prefs" ON workspace_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ---------- File history (automatic snapshots + named checkpoints) ----------
CREATE TABLE IF NOT EXISTS file_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  label TEXT, -- set for checkpoints
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_file_versions_file ON file_versions(file_id, created_at DESC);
ALTER TABLE file_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view file versions" ON file_versions;
CREATE POLICY "Members can view file versions" ON file_versions FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

-- ---------- Session replay: the Yjs updates of each save, in order ----------
CREATE TABLE IF NOT EXISTS doc_updates (
  id BIGSERIAL PRIMARY KEY,
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  data TEXT NOT NULL, -- base64 Yjs update
  user_ids UUID[] NOT NULL DEFAULT '{}', -- who typed in this stretch
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_doc_updates_file ON doc_updates(file_id, id);
ALTER TABLE doc_updates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view replays" ON doc_updates;
CREATE POLICY "Members can view replays" ON doc_updates FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

-- ---------- Activity feed and audit log ----------
CREATE TABLE IF NOT EXISTS activity (
  id BIGSERIAL PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activity_workspace ON activity(workspace_id, id DESC);
ALTER TABLE activity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view activity" ON activity;
CREATE POLICY "Members can view activity" ON activity FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

-- File changes are logged here; member and sharing changes are logged by the backend
CREATE OR REPLACE FUNCTION public.log_file_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE kind TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    kind := CASE WHEN NEW.is_folder THEN 'folder' ELSE 'file' END;
    INSERT INTO activity (workspace_id, user_id, action, details)
    VALUES (NEW.workspace_id, COALESCE(auth.uid(), NEW.created_by), kind || '_created', jsonb_build_object('path', NEW.path));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Rows removed by a cascade (their folder or workspace is already gone) aren't logged one by one
    IF NOT EXISTS (SELECT 1 FROM workspaces WHERE id = OLD.workspace_id)
       OR (OLD.parent_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM files WHERE id = OLD.parent_id)) THEN
      RETURN OLD;
    END IF;
    kind := CASE WHEN OLD.is_folder THEN 'folder' ELSE 'file' END;
    INSERT INTO activity (workspace_id, user_id, action, details)
    VALUES (OLD.workspace_id, auth.uid(), kind || '_deleted', jsonb_build_object('path', OLD.path));
    RETURN OLD;
  END IF;
  -- UPDATE: only the row that was renamed or moved, not the descendants whose paths followed
  IF NEW.name IS DISTINCT FROM OLD.name OR NEW.parent_id IS DISTINCT FROM OLD.parent_id THEN
    INSERT INTO activity (workspace_id, user_id, action, details)
    VALUES (NEW.workspace_id, auth.uid(), CASE WHEN NEW.name IS DISTINCT FROM OLD.name THEN 'file_renamed' ELSE 'file_moved' END,
            jsonb_build_object('from', OLD.path, 'to', NEW.path));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS files_activity ON files;
CREATE TRIGGER files_activity AFTER INSERT OR DELETE OR UPDATE OF name, parent_id ON files
  FOR EACH ROW EXECUTE FUNCTION public.log_file_activity();

-- ---------- Invites: shareable links and invites for people without an account yet ----------
CREATE TABLE IF NOT EXISTS workspace_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  token TEXT UNIQUE, -- link invites
  email TEXT, -- pending invites, claimed when that person signs in
  role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('editor', 'viewer')),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (token IS NOT NULL OR email IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_invites_email ON workspace_invites(lower(email));
ALTER TABLE workspace_invites ENABLE ROW LEVEL SECURITY; -- backend only

-- ---------- Test cases (shared per file) ----------
CREATE TABLE IF NOT EXISTS test_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  input TEXT NOT NULL DEFAULT '' CHECK (length(input) <= 20000),
  expected_output TEXT NOT NULL DEFAULT '' CHECK (length(expected_output) <= 20000),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_test_cases_file ON test_cases(file_id);
ALTER TABLE test_cases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view tests" ON test_cases;
DROP POLICY IF EXISTS "Editors can add tests" ON test_cases;
DROP POLICY IF EXISTS "Editors can change tests" ON test_cases;
DROP POLICY IF EXISTS "Editors can delete tests" ON test_cases;
CREATE POLICY "Members can view tests" ON test_cases FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));
CREATE POLICY "Editors can add tests" ON test_cases FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.get_user_editable_workspace_ids(auth.uid())));
CREATE POLICY "Editors can change tests" ON test_cases FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.get_user_editable_workspace_ids(auth.uid())))
  WITH CHECK (workspace_id IN (SELECT public.get_user_editable_workspace_ids(auth.uid())));
CREATE POLICY "Editors can delete tests" ON test_cases FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.get_user_editable_workspace_ids(auth.uid())));

-- Everyone in a workspace sees its runs (run history, shared output)
DROP POLICY IF EXISTS "Members can view workspace runs" ON execution_logs;
CREATE POLICY "Members can view workspace runs" ON execution_logs FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));
CREATE INDEX IF NOT EXISTS idx_execution_logs_workspace ON execution_logs(workspace_id, created_at DESC);

-- ---------- Comments (anchored to code), chat, notifications ----------
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE, -- set for replies
  anchor JSONB, -- Yjs relative position, so the comment follows its line as code changes
  line INT, -- line when posted, used if the anchor can't be resolved
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 5000),
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_comments_file ON comments(file_id);
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view comments" ON comments;
DROP POLICY IF EXISTS "Members can comment" ON comments;
DROP POLICY IF EXISTS "Members can resolve comments" ON comments;
DROP POLICY IF EXISTS "Authors can delete comments" ON comments;
CREATE POLICY "Members can view comments" ON comments FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));
CREATE POLICY "Members can comment" ON comments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))
    AND file_id IN (SELECT id FROM files WHERE workspace_id = comments.workspace_id));
CREATE POLICY "Members can resolve comments" ON comments FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));
CREATE POLICY "Authors can delete comments" ON comments FOR DELETE TO authenticated
  USING (user_id = auth.uid());
REVOKE UPDATE ON comments FROM anon, authenticated;
GRANT UPDATE (resolved) ON comments TO authenticated;

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_workspace ON messages(workspace_id, created_at DESC);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can read chat" ON messages;
DROP POLICY IF EXISTS "Members can chat" ON messages;
CREATE POLICY "Members can read chat" ON messages FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));
CREATE POLICY "Members can chat" ON messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- mention | reply | invite
  body TEXT,
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own notifications" ON notifications;
DROP POLICY IF EXISTS "Mark own notifications read" ON notifications;
DROP POLICY IF EXISTS "Delete own notifications" ON notifications;
CREATE POLICY "Own notifications" ON notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Mark own notifications read" ON notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Delete own notifications" ON notifications FOR DELETE TO authenticated USING (user_id = auth.uid());
REVOKE UPDATE ON notifications FROM anon, authenticated;
GRANT UPDATE (read) ON notifications TO authenticated;

-- "@Display Name" in a comment or chat message notifies that member
CREATE OR REPLACE FUNCTION public.notify_mentions(p_workspace UUID, p_author UUID, p_body TEXT, p_link TEXT)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO notifications (user_id, actor_id, workspace_id, type, body, link)
  SELECT m.user_id, p_author, p_workspace, 'mention', left(p_body, 200), p_link
  FROM workspace_members m JOIN profiles p ON p.id = m.user_id
  WHERE m.workspace_id = p_workspace AND m.user_id <> p_author
    AND coalesce(p.display_name, '') <> ''
    AND position('@' || lower(p.display_name) IN lower(p_body)) > 0;
$$;

CREATE OR REPLACE FUNCTION public.on_comment_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  parent_author UUID;
  link TEXT := '/editor/' || NEW.workspace_id || '?file=' || NEW.file_id;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT user_id INTO parent_author FROM comments WHERE id = NEW.parent_id;
    IF parent_author IS NOT NULL AND parent_author <> NEW.user_id THEN
      INSERT INTO notifications (user_id, actor_id, workspace_id, type, body, link)
      VALUES (parent_author, NEW.user_id, NEW.workspace_id, 'reply', left(NEW.body, 200), link);
    END IF;
  END IF;
  PERFORM public.notify_mentions(NEW.workspace_id, NEW.user_id, NEW.body, link);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS comments_notify ON comments;
CREATE TRIGGER comments_notify AFTER INSERT ON comments FOR EACH ROW EXECUTE FUNCTION public.on_comment_created();

CREATE OR REPLACE FUNCTION public.on_message_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_mentions(NEW.workspace_id, NEW.user_id, NEW.body, '/editor/' || NEW.workspace_id || '?panel=chat');
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS messages_notify ON messages;
CREATE TRIGGER messages_notify AFTER INSERT ON messages FOR EACH ROW EXECUTE FUNCTION public.on_message_created();

-- ---------- Account deletion ----------
-- Deleting an account keeps the files that person created in other people's workspaces
ALTER TABLE files DROP CONSTRAINT IF EXISTS files_created_by_fkey;
ALTER TABLE files ADD CONSTRAINT files_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ---------- Quotas ----------
-- ponytail: fixed limits; move to a plans table if you ever sell tiers
ALTER TABLE files DROP CONSTRAINT IF EXISTS files_content_size;
ALTER TABLE files ADD CONSTRAINT files_content_size CHECK (content IS NULL OR length(content) <= 1000000) NOT VALID;

CREATE OR REPLACE FUNCTION public.check_file_quota()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM files WHERE workspace_id = NEW.workspace_id) >= 500 THEN
    RAISE EXCEPTION 'A workspace can hold up to 500 files and folders';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS files_quota ON files;
CREATE TRIGGER files_quota BEFORE INSERT ON files FOR EACH ROW EXECUTE FUNCTION public.check_file_quota();

-- ---------- Realtime ----------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['workspaces', 'workspace_members', 'activity', 'comments', 'messages', 'notifications', 'test_cases'] LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
    EXCEPTION WHEN duplicate_object THEN
      NULL; -- already published
    END;
  END LOOP;
END $$;
