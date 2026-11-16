-- 003_enable_realtime_replication.sql
-- Publishes changes on the files table to Supabase Realtime.
-- 001 already does this; the guard makes re-running safe instead of erroring.

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE files;
EXCEPTION WHEN duplicate_object THEN
  NULL; -- already published
END $$;
