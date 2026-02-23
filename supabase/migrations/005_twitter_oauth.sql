-- Twitter/X API OAuth tokens for automated DM sending
-- Mirrors the gmail_tokens pattern

CREATE TABLE IF NOT EXISTS twitter_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  twitter_user_id TEXT NOT NULL,
  twitter_handle TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expiry TIMESTAMPTZ,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE twitter_tokens ENABLE ROW LEVEL SECURITY;

-- RLS: Users can read own tokens (browser client)
CREATE POLICY "Users can read own twitter tokens"
  ON twitter_tokens FOR SELECT
  USING (auth.uid() = user_id);

-- Auto-update updated_at
CREATE TRIGGER update_twitter_tokens_updated_at
  BEFORE UPDATE ON twitter_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Add twitter_user_id to campaign_recipients for API sending
-- (Resolved from twitter_handle via /2/users/by/username/:username)
ALTER TABLE campaign_recipients
  ADD COLUMN IF NOT EXISTS twitter_user_id TEXT;
