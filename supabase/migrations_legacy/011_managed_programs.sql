-- Admin-managed high school programs
-- Replaces the coach_profiles-based system for branded landing pages

CREATE TABLE managed_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_name TEXT NOT NULL,        -- e.g. "Prairie"
  mascot TEXT,                      -- e.g. "Hawks"
  city TEXT,
  state TEXT,
  landing_slug TEXT UNIQUE,         -- e.g. "prairie-ia"
  logo_url TEXT,
  primary_color TEXT DEFAULT '#0047AB',
  secondary_color TEXT DEFAULT '#FFFFFF',
  accent_color TEXT DEFAULT '#CC0000',
  twitter_username TEXT,
  hudl_url TEXT,
  instagram_username TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE program_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES managed_programs(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('coach', 'player')),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(program_id, email)
);

-- Update access_requests to support managed_programs and admin requests
ALTER TABLE access_requests
  ADD COLUMN program_id UUID REFERENCES managed_programs(id) ON DELETE CASCADE,
  ADD COLUMN request_type TEXT NOT NULL DEFAULT 'program',
  ALTER COLUMN coach_profile_id DROP NOT NULL;

-- RLS for managed_programs
ALTER TABLE managed_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage programs" ON managed_programs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Public read for landing pages" ON managed_programs
  FOR SELECT USING (landing_slug IS NOT NULL);

-- RLS for program_members
ALTER TABLE program_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage members" ON program_members
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Members can view own membership" ON program_members
  FOR SELECT USING (user_id = auth.uid());

-- Supabase Storage bucket for program logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('program-logos', 'program-logos', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public logo access" ON storage.objects
  FOR SELECT USING (bucket_id = 'program-logos');

CREATE POLICY "Admins can upload logos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'program-logos' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete logos" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'program-logos' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Trigger for updated_at
CREATE TRIGGER update_managed_programs_updated_at
  BEFORE UPDATE ON managed_programs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX idx_program_members_program ON program_members(program_id);
CREATE INDEX idx_program_members_email ON program_members(email);
CREATE INDEX idx_managed_programs_slug ON managed_programs(landing_slug);
