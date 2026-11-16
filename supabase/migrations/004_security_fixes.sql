-- ============================================================
-- 004: Security fixes. Run in Supabase SQL Editor after 001/002.
-- ============================================================

-- 1. Members: clients may no longer insert themselves into any workspace.
--    All member inserts go through the backend (service role).
DROP POLICY IF EXISTS "Owners can manage members" ON workspace_members;


-- 2. Files: only owners/editors can write. Viewers are read-only.
CREATE OR REPLACE FUNCTION public.get_user_editable_workspace_ids(uid UUID)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT workspace_id FROM workspace_members
  WHERE user_id = uid AND role IN ('owner', 'editor');
$$;

DROP POLICY IF EXISTS "Editors can create files" ON files;
DROP POLICY IF EXISTS "Editors can update files" ON files;
DROP POLICY IF EXISTS "Editors can delete files" ON files;

CREATE POLICY "Editors can create files"
  ON files FOR INSERT
  TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.get_user_editable_workspace_ids(auth.uid())));

CREATE POLICY "Editors can update files"
  ON files FOR UPDATE
  TO authenticated
  USING (workspace_id IN (SELECT public.get_user_editable_workspace_ids(auth.uid())))
  WITH CHECK (workspace_id IN (SELECT public.get_user_editable_workspace_ids(auth.uid())));

CREATE POLICY "Editors can delete files"
  ON files FOR DELETE
  TO authenticated
  USING (workspace_id IN (SELECT public.get_user_editable_workspace_ids(auth.uid())));


-- 3. Profiles: visible only to yourself and people you share a workspace with.
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON profiles;

CREATE POLICY "Profiles visible to self and co-members"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR id IN (
      SELECT user_id FROM workspace_members
      WHERE workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))
    )
  );


-- 4. Profiles: email is locked to the auth email (invites look users up by it).
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id AND email = auth.email());

REVOKE UPDATE ON profiles FROM anon, authenticated;
GRANT UPDATE (display_name, avatar_url) ON profiles TO authenticated;
