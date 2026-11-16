-- ============================================================
-- 007: Authorship, suggestions, reactions, paste detection, forks, live tests,
-- classroom wall and races. Run in the Supabase SQL Editor after 006. Safe to re-run.
-- ============================================================

-- Who wrote what: Yjs client id -> user id, saved with each file's history
ALTER TABLE file_states ADD COLUMN IF NOT EXISTS authors JSONB NOT NULL DEFAULT '{}';

-- ---------- Workspaces ----------
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS fork_of UUID REFERENCES workspaces(id) ON DELETE SET NULL;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS fork_base JSONB; -- { "/path": text } when the fork was made, for 3-way merges
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS watch_tests BOOLEAN NOT NULL DEFAULT FALSE; -- rerun tests on every save
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS race_ends_at TIMESTAMPTZ; -- classroom turned into a timed race
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS hand_raised_at TIMESTAMPTZ; -- a student asking for help (on their copy)
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS hand_note TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS tests_passed INT; -- latest test score, for the wall and race leaderboard
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS tests_total INT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS tests_passed_at TIMESTAMPTZ; -- when every test first passed (race finish)
CREATE INDEX IF NOT EXISTS idx_workspaces_fork ON workspaces(fork_of);

-- ---------- Suggestions: proposed edits someone else accepts or rejects ----------
CREATE TABLE IF NOT EXISTS suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- null for live-stream guests
  guest_name TEXT,
  anchor_start JSONB, -- Yjs relative positions, so the range follows edits
  anchor_end JSONB,
  line INT,
  original TEXT NOT NULL CHECK (length(original) <= 20000),
  replacement TEXT NOT NULL CHECK (length(replacement) <= 20000),
  note TEXT CHECK (length(note) <= 2000),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'rejected')),
  decided_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_suggestions_file ON suggestions(file_id);
ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view suggestions" ON suggestions;
DROP POLICY IF EXISTS "Members can suggest" ON suggestions;
CREATE POLICY "Members can view suggestions" ON suggestions FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));
CREATE POLICY "Members can suggest" ON suggestions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'open' AND workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));
-- Accepting and rejecting go through the backend, which applies the edit

-- ---------- Reactions on lines ----------
CREATE TABLE IF NOT EXISTS reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  anchor JSONB,
  line INT,
  emoji TEXT NOT NULL CHECK (emoji IN ('👍', '🤔', '🔥', '❤️', '🎉', '👀')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reactions_file ON reactions(file_id);
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view reactions" ON reactions;
DROP POLICY IF EXISTS "Members can react" ON reactions;
DROP POLICY IF EXISTS "Remove own reactions" ON reactions;
CREATE POLICY "Members can view reactions" ON reactions FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));
CREATE POLICY "Members can react" ON reactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));
CREATE POLICY "Remove own reactions" ON reactions FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ---------- Paste detection ----------
CREATE TABLE IF NOT EXISTS paste_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  chars INT NOT NULL,
  lines INT NOT NULL,
  anchor_start JSONB,
  anchor_end JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_paste_events_file ON paste_events(file_id, created_at);
ALTER TABLE paste_events ENABLE ROW LEVEL SECURITY; -- written by the backend
DROP POLICY IF EXISTS "Members can view pastes" ON paste_events;
CREATE POLICY "Members can view pastes" ON paste_events FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

-- ---------- Realtime ----------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['suggestions', 'reactions', 'paste_events'] LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END LOOP;
END $$;
