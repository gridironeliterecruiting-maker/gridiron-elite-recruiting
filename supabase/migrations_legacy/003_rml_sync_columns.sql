-- RML (RecruitingMasterList) Sync Support
-- Adds tracking columns for automated coach data sync

-- coaches: flag for soft-delete (can't hard delete due to FK references)
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- coaches: composite key for deduplication during sync
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS rml_source_key TEXT;

-- programs: store the full RML school name alongside the short DB name
ALTER TABLE programs ADD COLUMN IF NOT EXISTS rml_school_name TEXT;

-- Indexes for sync queries
CREATE INDEX IF NOT EXISTS idx_coaches_rml_source_key ON coaches(rml_source_key);
CREATE INDEX IF NOT EXISTS idx_coaches_is_active ON coaches(is_active);
CREATE INDEX IF NOT EXISTS idx_programs_rml_school_name ON programs(rml_school_name);
