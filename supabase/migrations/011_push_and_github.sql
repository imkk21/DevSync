-- 011: phone/desktop notifications and GitHub sync.
-- Run after 010. Safe to run more than once.
-- All three tables are read and written only by the server (RLS on, no policies): they hold
-- secrets (push keys, GitHub access) that the browser never needs to see.

-- ---------- Push notifications: one row per browser or phone that turned them on ----------
CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint TEXT PRIMARY KEY CHECK (endpoint LIKE 'https://%' AND length(endpoint) <= 1000),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- ---------- GitHub: a person's connected account (the token is encrypted by the server) ----------
CREATE TABLE IF NOT EXISTS github_accounts (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  login TEXT NOT NULL,
  token TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE github_accounts ENABLE ROW LEVEL SECURITY;

-- ---------- GitHub: the repo a workspace came from or was pushed to ----------
-- sha is the last commit DevSync imported or pushed; paths are the files it had, so a later
-- push knows which files were deleted in DevSync (and leaves skipped ones like images alone).
CREATE TABLE IF NOT EXISTS github_links (
  workspace_id UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  repo TEXT NOT NULL CHECK (repo ~ '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$'),
  branch TEXT NOT NULL,
  sha TEXT NOT NULL CHECK (sha ~ '^[0-9a-f]{40}$'),
  paths TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE github_links ENABLE ROW LEVEL SECURITY;
