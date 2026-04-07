-- 003_enable_realtime_replication.sql
-- This tells Supabase to "Publish" changes on the files table to its Realtime engine.
-- Without this, Supabase will not notify other users when a file is saved!

-- Enable replication for the 'files' table
ALTER PUBLICATION supabase_realtime ADD TABLE files;

-- Optional: If you want to sync workspace memberships (e.g. for presence), do it too
-- ALTER PUBLICATION supabase_realtime ADD TABLE workspace_members;
