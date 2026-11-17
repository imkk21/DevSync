-- 012: search across workspaces, and "since you were last here" on the dashboard.
-- Run after 011. Safe to run more than once.

-- When each person last left each workspace (the server sets it; members can't edit it directly)
ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- Recent changes per workspace, for the dashboard summary
CREATE INDEX IF NOT EXISTS idx_doc_updates_workspace_time ON doc_updates(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_workspace_time ON activity(workspace_id, created_at DESC);

-- Fast "contains" search on code, file names, chat and tasks (trigram indexes).
-- Supabase keeps extensions in the "extensions" schema; this finds wherever pg_trgm lives.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
DO $$
DECLARE s TEXT;
BEGIN
  SELECT n.nspname INTO s FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'pg_trgm';
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_files_content_trgm ON files USING gin (content %I.gin_trgm_ops)', s);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_files_name_trgm ON files USING gin (name %I.gin_trgm_ops)', s);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_messages_body_trgm ON messages USING gin (body %I.gin_trgm_ops)', s);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_tasks_title_trgm ON tasks USING gin (title %I.gin_trgm_ops)', s);
END $$;
