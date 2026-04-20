-- Migration 006: Athlete Documents / Recruiting Drive
-- Adds a document repository for athletes to share with coaches

-- Add share slug to profiles for public recruiting page URL
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS share_slug TEXT UNIQUE;

-- Create index for fast lookup by slug
CREATE INDEX IF NOT EXISTS idx_profiles_share_slug ON profiles(share_slug);

-- Athlete documents table
CREATE TABLE IF NOT EXISTS athlete_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'link',  -- 'link', 'file', 'video'
  url TEXT,                            -- external URL or Supabase Storage path
  file_path TEXT,                      -- Supabase Storage object path (for uploaded files)
  file_name TEXT,                      -- Original file name
  file_size INTEGER,                   -- File size in bytes
  file_type TEXT,                      -- MIME type
  display_order INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_athlete_documents_athlete ON athlete_documents(athlete_id);
CREATE INDEX IF NOT EXISTS idx_athlete_documents_order ON athlete_documents(athlete_id, display_order);

-- Enable RLS
ALTER TABLE athlete_documents ENABLE ROW LEVEL SECURITY;

-- Athletes can manage their own documents
CREATE POLICY "Athletes can view own documents" ON athlete_documents
  FOR SELECT USING (
    athlete_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Athletes can insert own documents" ON athlete_documents
  FOR INSERT WITH CHECK (athlete_id = auth.uid());

CREATE POLICY "Athletes can update own documents" ON athlete_documents
  FOR UPDATE USING (athlete_id = auth.uid());

CREATE POLICY "Athletes can delete own documents" ON athlete_documents
  FOR DELETE USING (athlete_id = auth.uid());

-- Updated_at trigger
CREATE TRIGGER update_athlete_documents_updated_at
  BEFORE UPDATE ON athlete_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
