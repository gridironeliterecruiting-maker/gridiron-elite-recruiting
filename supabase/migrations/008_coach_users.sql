-- ============================================
-- 008: Coach User Type — Phase 1
-- Adds 'coach' role, coach_profiles, coach_players tables,
-- player_id on campaigns, and updated RLS policies.
-- ============================================

-- 1. Add 'coach' to user_role enum
ALTER TYPE user_role ADD VALUE 'coach';

-- 2. Coach profiles — branding and metadata per coach user
CREATE TABLE coach_profiles (
  id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  program_name TEXT NOT NULL,
  title TEXT,
  logo_url TEXT,
  primary_color TEXT,  -- HSL string e.g. "224 76% 30%"
  accent_color TEXT,   -- HSL string e.g. "0 72% 51%"
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE coach_profiles ENABLE ROW LEVEL SECURITY;

-- Coach reads/updates own row
CREATE POLICY "Coaches can view own coach_profile" ON coach_profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Coaches can update own coach_profile" ON coach_profiles
  FOR UPDATE USING (auth.uid() = id);
-- Admins manage all
CREATE POLICY "Admins can manage coach_profiles" ON coach_profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE TRIGGER update_coach_profiles_updated_at BEFORE UPDATE ON coach_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3. Coach–Player associations (many-to-many)
CREATE TABLE coach_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(coach_id, player_id)
);

ALTER TABLE coach_players ENABLE ROW LEVEL SECURITY;

-- Coach reads own links
CREATE POLICY "Coaches can view own coach_players" ON coach_players
  FOR SELECT USING (auth.uid() = coach_id);
-- Admins manage all
CREATE POLICY "Admins can manage coach_players" ON coach_players
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX idx_coach_players_coach ON coach_players(coach_id);
CREATE INDEX idx_coach_players_player ON coach_players(player_id);

-- 4. Add player_id to campaigns
-- NULL = athlete's own campaign; set = coach acting on behalf of player
ALTER TABLE campaigns ADD COLUMN player_id UUID REFERENCES profiles(id);

-- 5. Update handle_new_user trigger — upsert so pre-created coach profiles survive
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(profiles.email, EXCLUDED.email),
    first_name = COALESCE(profiles.first_name, EXCLUDED.first_name),
    last_name = COALESCE(profiles.last_name, EXCLUDED.last_name),
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RLS additions — coaches can SELECT profiles of assigned players
CREATE POLICY "Coaches can view assigned player profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM coach_players
      WHERE coach_players.coach_id = auth.uid()
        AND coach_players.player_id = profiles.id
    )
  );

-- Coaches can SELECT pipeline_entries for assigned players
CREATE POLICY "Coaches can view assigned player pipeline" ON pipeline_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM coach_players
      WHERE coach_players.coach_id = auth.uid()
        AND coach_players.player_id = pipeline_entries.athlete_id
    )
  );

-- 7. Role-based email templates
-- Coaches see coach templates, athletes see athlete templates
ALTER TABLE email_templates ADD COLUMN for_role TEXT DEFAULT 'athlete';
UPDATE email_templates SET for_role = 'athlete' WHERE for_role IS NULL;

-- Coach system templates
INSERT INTO email_templates (name, subject, body, is_system, for_role) VALUES
  ('Coach Recommendation',
   'Player Recommendation — ((First_Name)) ((Last_Name)) | ((Position)) | Class of ((Grad_Year))',
   'Coach ((Coach_Last_Name)),

I''m reaching out to recommend one of my players, ((First_Name)) ((Last_Name)), a ((Position)) in the Class of ((Grad_Year)) at ((High_School)) in ((City)), ((State)).

((First_Name)) is an outstanding student-athlete who I believe would be a great fit for your program at ((School_Name)). I''ve had the privilege of coaching ((First_Name)) and can speak to both the athletic ability and character that would make a strong addition to your team.

Here is a link to ((First_Name))''s highlight film: ((Film_Link))

I''d welcome the opportunity to discuss ((First_Name))''s potential with you. Please don''t hesitate to reach out.',
   TRUE, 'coach'),

  ('Coach Film Referral',
   'Film Recommendation — ((First_Name)) ((Last_Name)) | ((Position)) | ((Grad_Year))',
   'Coach ((Coach_Last_Name)),

I wanted to pass along updated film on one of my players, ((First_Name)) ((Last_Name)). ((First_Name)) is a ((Position)) in the Class of ((Grad_Year)) who I think could contribute at ((School_Name)).

Film: ((Film_Link))

((First_Name)) has been putting in the work this offseason and I believe the film speaks for itself. I''d be happy to provide any additional information you need.',
   TRUE, 'coach');

-- ============================================
-- MANUAL SETUP: Create a test coach account
-- Run these after the migration, replacing UUIDs with real values.
-- ============================================
-- Step 1: Pre-create the profile row (before the coach logs in via Google OAuth)
--   INSERT INTO profiles (id, role, first_name, last_name, email)
--   VALUES ('<coach-auth-user-uuid>', 'coach', 'Coach', 'Smith', 'coach@example.com');
--
-- Step 2: Create the coach_profile for branding
--   INSERT INTO coach_profiles (id, program_name, title, logo_url, primary_color, accent_color)
--   VALUES ('<coach-auth-user-uuid>', 'Iowa Hawkeyes', 'Head Coach', NULL, '45 100% 51%', '0 0% 15%');
--
-- Step 3: Link players to coach
--   INSERT INTO coach_players (coach_id, player_id)
--   VALUES ('<coach-auth-user-uuid>', '<player1-uuid>'),
--          ('<coach-auth-user-uuid>', '<player2-uuid>');
