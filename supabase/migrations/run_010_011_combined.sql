-- ============================================================
-- Combined migration: 010 (access_requests) + 011 (managed_programs)
-- Run this in the Supabase Dashboard SQL Editor
-- ============================================================

-- 010: Access requests table
CREATE TABLE IF NOT EXISTS access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  user_name TEXT,
  coach_profile_id UUID REFERENCES coach_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  request_type TEXT NOT NULL DEFAULT 'program',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Coaches can view their access requests' AND tablename = 'access_requests') THEN
    CREATE POLICY "Coaches can view their access requests" ON access_requests FOR SELECT USING (coach_profile_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Coaches can update their access requests' AND tablename = 'access_requests') THEN
    CREATE POLICY "Coaches can update their access requests" ON access_requests FOR UPDATE USING (coach_profile_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can create access requests' AND tablename = 'access_requests') THEN
    CREATE POLICY "Users can create access requests" ON access_requests FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own requests' AND tablename = 'access_requests') THEN
    CREATE POLICY "Users can view their own requests" ON access_requests FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;

-- 011: Managed programs + program members
CREATE TABLE IF NOT EXISTS managed_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_name TEXT NOT NULL,
  mascot TEXT,
  city TEXT,
  state TEXT,
  landing_slug TEXT UNIQUE,
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

CREATE TABLE IF NOT EXISTS program_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES managed_programs(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('coach', 'player')),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(program_id, email)
);

-- Add program_id to access_requests if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'access_requests' AND column_name = 'program_id') THEN
    ALTER TABLE access_requests ADD COLUMN program_id UUID REFERENCES managed_programs(id) ON DELETE CASCADE;
  END IF;
END $$;

-- RLS for managed_programs
ALTER TABLE managed_programs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage programs' AND tablename = 'managed_programs') THEN
    CREATE POLICY "Admins can manage programs" ON managed_programs FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read for landing pages' AND tablename = 'managed_programs') THEN
    CREATE POLICY "Public read for landing pages" ON managed_programs FOR SELECT USING (landing_slug IS NOT NULL);
  END IF;
END $$;

-- RLS for program_members
ALTER TABLE program_members ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage members' AND tablename = 'program_members') THEN
    CREATE POLICY "Admins can manage members" ON program_members FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Members can view own membership' AND tablename = 'program_members') THEN
    CREATE POLICY "Members can view own membership" ON program_members FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;

-- Storage bucket for program logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('program-logos', 'program-logos', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public logo access' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Public logo access" ON storage.objects FOR SELECT USING (bucket_id = 'program-logos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can upload logos' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Admins can upload logos" ON storage.objects FOR INSERT WITH CHECK (
      bucket_id = 'program-logos' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can delete logos' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Admins can delete logos" ON storage.objects FOR DELETE USING (
      bucket_id = 'program-logos' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

-- Trigger for updated_at on managed_programs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_managed_programs_updated_at') THEN
    CREATE TRIGGER update_managed_programs_updated_at
      BEFORE UPDATE ON managed_programs
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_program_members_program ON program_members(program_id);
CREATE INDEX IF NOT EXISTS idx_program_members_email ON program_members(email);
CREATE INDEX IF NOT EXISTS idx_managed_programs_slug ON managed_programs(landing_slug);
