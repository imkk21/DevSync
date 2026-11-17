-- ============================================================
-- 009: Tasks and milestones, polls and quizzes, events, shared files, portfolios,
-- team check-ins and focus sessions, flashcards. Run after 008. Safe to re-run.
-- Wiki pages and whiteboards are ordinary workspace files, so they need nothing here.
-- ============================================================

-- ---------- Milestones and tasks ----------
CREATE TABLE IF NOT EXISTS milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  due_date DATE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_milestones_workspace ON milestones(workspace_id);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  description TEXT CHECK (length(description) <= 5000),
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'done')),
  position DOUBLE PRECISION NOT NULL DEFAULT 0, -- order within a column
  assignee_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  due_date DATE,
  milestone_id UUID REFERENCES milestones(id) ON DELETE SET NULL,
  file_id UUID REFERENCES files(id) ON DELETE SET NULL, -- linked code
  anchor JSONB, -- Yjs relative position of the linked line
  line INT,
  done_when_tests_pass BOOLEAN NOT NULL DEFAULT FALSE, -- moves to Done when the file's tests all pass
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON tasks(workspace_id);

-- ---------- Polls and quizzes ----------
CREATE TABLE IF NOT EXISTS polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  question TEXT NOT NULL CHECK (length(question) BETWEEN 1 AND 300),
  options JSONB NOT NULL, -- ["A", "B", ...], 2 to 6
  correct INT, -- set for quizzes: index of the right answer, shown once closed
  closed BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS poll_votes (
  poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE DEFAULT auth.uid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  choice INT NOT NULL CHECK (choice BETWEEN 0 AND 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (poll_id, user_id)
);

-- ---------- Events ----------
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  description TEXT CHECK (length(description) <= 5000),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  reminded BOOLEAN NOT NULL DEFAULT FALSE, -- the 15-minute reminder went out
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_events_starts ON events(starts_at);
CREATE TABLE IF NOT EXISTS event_rsvps (
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE DEFAULT auth.uid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (event_id, user_id)
);

-- ---------- Team health ----------
CREATE TABLE IF NOT EXISTS checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE DEFAULT auth.uid(),
  week DATE NOT NULL, -- Monday of the week
  mood INT NOT NULL CHECK (mood BETWEEN 1 AND 5),
  note TEXT CHECK (length(note) <= 500),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (workspace_id, user_id, week)
);
CREATE TABLE IF NOT EXISTS focus_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE DEFAULT auth.uid(),
  minutes INT NOT NULL CHECK (minutes BETWEEN 1 AND 240),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- Flashcards (private to each person) ----------
CREATE TABLE IF NOT EXISTS flashcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE DEFAULT auth.uid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  front TEXT NOT NULL CHECK (length(front) BETWEEN 1 AND 4000),
  back TEXT NOT NULL CHECK (length(back) BETWEEN 1 AND 8000),
  source TEXT, -- 'test', 'code', 'manual'
  due_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  interval_days REAL NOT NULL DEFAULT 0,
  ease REAL NOT NULL DEFAULT 2.5,
  reps INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_flashcards_due ON flashcards(user_id, due_at);

-- ---------- Row level security ----------
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE focus_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  -- Members read; editors write (milestones, tasks, events, polls)
  FOREACH t IN ARRAY ARRAY['milestones', 'tasks', 'events', 'polls'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Members read %1$s" ON %1$I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Editors write %1$s" ON %1$I', t);
    EXECUTE format('CREATE POLICY "Members read %1$s" ON %1$I FOR SELECT TO authenticated USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())))', t);
    EXECUTE format('CREATE POLICY "Editors write %1$s" ON %1$I FOR ALL TO authenticated USING (workspace_id IN (SELECT public.get_user_editable_workspace_ids(auth.uid()))) WITH CHECK (workspace_id IN (SELECT public.get_user_editable_workspace_ids(auth.uid())))', t);
  END LOOP;
  -- Members read everyone's; each person writes only their own (votes, RSVPs, check-ins, focus)
  FOREACH t IN ARRAY ARRAY['poll_votes', 'event_rsvps', 'checkins', 'focus_sessions'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Members read %1$s" ON %1$I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Own %1$s" ON %1$I', t);
    EXECUTE format('CREATE POLICY "Members read %1$s" ON %1$I FOR SELECT TO authenticated USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())))', t);
    EXECUTE format('CREATE POLICY "Own %1$s" ON %1$I FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())))', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Own flashcards" ON flashcards;
CREATE POLICY "Own flashcards" ON flashcards FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- A vote must be for a poll in the same workspace
CREATE OR REPLACE FUNCTION public.check_vote_workspace()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM polls WHERE id = NEW.poll_id AND workspace_id = NEW.workspace_id AND NOT closed) THEN
    RAISE EXCEPTION 'This poll is closed';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS poll_votes_check ON poll_votes;
CREATE TRIGGER poll_votes_check BEFORE INSERT OR UPDATE ON poll_votes FOR EACH ROW EXECUTE FUNCTION public.check_vote_workspace();

-- ---------- Portfolios ----------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS links JSONB NOT NULL DEFAULT '{}'; -- { github, linkedin, website }
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS showcase UUID[] NOT NULL DEFAULT '{}'; -- workspaces shown on the portfolio
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username ON profiles (lower(username));
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_username_format;
ALTER TABLE profiles ADD CONSTRAINT profiles_username_format CHECK (username IS NULL OR username ~ '^[a-z0-9][a-z0-9_-]{2,29}$');
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_bio_length;
ALTER TABLE profiles ADD CONSTRAINT profiles_bio_length CHECK (bio IS NULL OR length(bio) <= 300);
GRANT UPDATE (display_name, avatar_url, username, bio, links, showcase) ON profiles TO authenticated;

-- ---------- Shared files: a private bucket, one folder per workspace ----------
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('workspace-files', 'workspace-files', FALSE, 10485760)
ON CONFLICT (id) DO UPDATE SET public = FALSE, file_size_limit = 10485760;

DROP POLICY IF EXISTS "Members read workspace files" ON storage.objects;
DROP POLICY IF EXISTS "Editors add workspace files" ON storage.objects;
DROP POLICY IF EXISTS "Editors remove workspace files" ON storage.objects;
CREATE POLICY "Members read workspace files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'workspace-files' AND (storage.foldername(name))[1]::uuid IN (SELECT public.get_user_workspace_ids(auth.uid())));
CREATE POLICY "Editors add workspace files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'workspace-files' AND (storage.foldername(name))[1]::uuid IN (SELECT public.get_user_editable_workspace_ids(auth.uid())));
CREATE POLICY "Editors remove workspace files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'workspace-files' AND (storage.foldername(name))[1]::uuid IN (SELECT public.get_user_editable_workspace_ids(auth.uid())));

-- ---------- Realtime ----------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['milestones', 'tasks', 'polls', 'poll_votes', 'events', 'event_rsvps'] LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END LOOP;
END $$;
