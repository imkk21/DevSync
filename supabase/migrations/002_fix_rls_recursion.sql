-- ============================================================
-- HOTFIX: Fix infinite recursion in workspace_members RLS
-- Run this in Supabase SQL Editor NOW
-- ============================================================

-- Step 1: Create a SECURITY DEFINER function that bypasses RLS
-- This lets policies query workspace_members without triggering
-- the SELECT policy recursion
CREATE OR REPLACE FUNCTION public.get_user_workspace_ids(uid UUID)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT workspace_id FROM workspace_members WHERE user_id = uid;
$$;

-- Step 2: Drop ALL old policies that cause recursion
DROP POLICY IF EXISTS "Members can view workspaces" ON workspaces;
DROP POLICY IF EXISTS "Members can view workspace members" ON workspace_members;
DROP POLICY IF EXISTS "Owners can manage members" ON workspace_members;
DROP POLICY IF EXISTS "Owners can remove members" ON workspace_members;
DROP POLICY IF EXISTS "Members can view files" ON files;
DROP POLICY IF EXISTS "Editors can create files" ON files;
DROP POLICY IF EXISTS "Editors can update files" ON files;
DROP POLICY IF EXISTS "Editors can delete files" ON files;

-- Step 3: Recreate policies using the safe function

-- WORKSPACES: Members can view
CREATE POLICY "Members can view workspaces"
  ON workspaces FOR SELECT
  TO authenticated
  USING (id IN (SELECT public.get_user_workspace_ids(auth.uid())));

-- WORKSPACE MEMBERS: View (was recursive, now fixed)
CREATE POLICY "Members can view workspace members"
  ON workspace_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))
  );

-- WORKSPACE MEMBERS: Insert
CREATE POLICY "Owners can manage members"
  ON workspace_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );

-- WORKSPACE MEMBERS: Delete
CREATE POLICY "Owners can remove members"
  ON workspace_members FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );

-- FILES: View
CREATE POLICY "Members can view files"
  ON files FOR SELECT
  TO authenticated
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

-- FILES: Create
CREATE POLICY "Editors can create files"
  ON files FOR INSERT
  TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

-- FILES: Update
CREATE POLICY "Editors can update files"
  ON files FOR UPDATE
  TO authenticated
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

-- FILES: Delete
CREATE POLICY "Editors can delete files"
  ON files FOR DELETE
  TO authenticated
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));
