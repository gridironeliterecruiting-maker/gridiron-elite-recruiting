-- Migration 013: Email filing columns for inbox / folders
-- Adds fields to campaign_recipients to support:
--   - unread indicator (is_read)
--   - filing to Division > Conference > School > Coach folder tree (filed_at, filed_program_id, filed_coach_id)

ALTER TABLE campaign_recipients
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS filed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS filed_program_id UUID REFERENCES programs(id),
  ADD COLUMN IF NOT EXISTS filed_coach_id UUID REFERENCES coaches(id);

-- Index to make inbox queries fast (filed_at IS NULL = still in inbox)
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_inbox
  ON campaign_recipients (campaign_id, status, filed_at)
  WHERE status = 'replied';

-- Index for folder tree queries
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_filed
  ON campaign_recipients (filed_program_id, filed_coach_id, filed_at)
  WHERE filed_at IS NOT NULL;
