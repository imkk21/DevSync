-- 010: video messages, Slack/Discord alerts, calendar feeds.
-- Run after 009. Safe to run more than once.

-- ---------- Video messages: a chat message can carry a recorded clip ----------
-- { "kind": "video", "path": "<workspace id>/<time>-video-<user id>.webm", "seconds": 42 }
-- The clip lives in the private workspace-files bucket, so only members can open it.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment JSONB;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_attachment_shape;
ALTER TABLE messages ADD CONSTRAINT messages_attachment_shape CHECK (
  attachment IS NULL OR (
    attachment->>'kind' = 'video'
    AND attachment->>'path' LIKE workspace_id::text || '/%'
    AND length(attachment->>'path') <= 300
  )
);

-- ---------- Slack / Discord alerts ----------
-- Only the server reads or writes these (the URL is a secret that lets anyone post to the channel),
-- so RLS is on with no policies: the owner manages them through the API.
CREATE TABLE IF NOT EXISTS workspace_webhooks (
  workspace_id UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  url TEXT NOT NULL CHECK (url ~ '^https://(hooks\.slack\.com|discord\.com|discordapp\.com)/'),
  events TEXT[] NOT NULL DEFAULT ARRAY['tests', 'tasks', 'events', 'members'],
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE workspace_webhooks ENABLE ROW LEVEL SECURITY;

-- The server listens for finished tasks; it needs the old row to tell "just finished" from "edited while done"
ALTER TABLE tasks REPLICA IDENTITY FULL;

-- ---------- Calendar feeds: a private .ics link per person ----------
-- Anyone with the link can read your workspace events, so it's random, server-only, and can be reset.
CREATE TABLE IF NOT EXISTS calendar_feeds (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE calendar_feeds ENABLE ROW LEVEL SECURITY;
