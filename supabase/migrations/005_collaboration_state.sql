-- ============================================================
-- 005: Real-time collaboration state. Run in Supabase SQL Editor.
-- ============================================================

-- The Yjs edit history of each file (base64). The backend writes it next to
-- files.content so editors that reconnect merge their offline edits cleanly.
-- RLS is on with no policies: only the backend (service role) can read or write it.
CREATE TABLE IF NOT EXISTS file_states (
  file_id UUID PRIMARY KEY REFERENCES files(id) ON DELETE CASCADE,
  state TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE file_states ENABLE ROW LEVEL SECURITY;
