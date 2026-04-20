-- DM Assist Campaign Support
-- Adds DM campaign type and tracking columns

-- campaigns: discriminator for email vs DM campaigns
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'email';

-- campaigns: single DM template body with merge tags
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS dm_message_body TEXT;

-- campaign_recipients: denormalized twitter handle for DM Queue display
ALTER TABLE campaign_recipients ADD COLUMN IF NOT EXISTS twitter_handle TEXT;

-- campaign_recipients: when user marked DM as sent
ALTER TABLE campaign_recipients ADD COLUMN IF NOT EXISTS dm_sent_at TIMESTAMPTZ;

-- campaign_recipients: allow null email for DM-only coaches
ALTER TABLE campaign_recipients ALTER COLUMN coach_email DROP NOT NULL;

-- Index for filtering by campaign type
CREATE INDEX IF NOT EXISTS idx_campaigns_type ON campaigns(type);
