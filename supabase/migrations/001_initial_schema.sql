-- Gridiron Elite Recruiting — Initial Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- ============================================
-- ENUMS
-- ============================================
CREATE TYPE user_role AS ENUM ('athlete', 'admin');
CREATE TYPE division AS ENUM ('FBS', 'FCS', 'DII', 'DIII', 'JUCO', 'NAIA');
CREATE TYPE pipeline_status AS ENUM ('active', 'dead', 'committed');
CREATE TYPE interaction_type AS ENUM (
  'email_sent', 'email_received', 'dm_sent', 'dm_received',
  'call', 'visit', 'film_sent', 'questionnaire',
  'camp_invite', 'offer', 'other'
);
CREATE TYPE interaction_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE action_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE action_status AS ENUM ('pending', 'completed', 'dismissed');
CREATE TYPE email_status AS ENUM ('queued', 'sent', 'delivered', 'opened', 'bounced', 'failed');

-- ============================================
-- PROFILES (extends auth.users)
-- ============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'athlete',
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  grad_year INTEGER,
  high_school TEXT,
  city TEXT,
  state TEXT,
  position TEXT,
  height TEXT,
  weight INTEGER,
  gpa DECIMAL(3,2),
  hudl_url TEXT,
  twitter_handle TEXT,
  profile_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- PROGRAMS
-- ============================================
CREATE TABLE programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_name TEXT NOT NULL,
  division division NOT NULL,
  conference TEXT,
  state TEXT,
  city TEXT,
  website TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- COACHES
-- ============================================
CREATE TABLE coaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  title TEXT,
  email TEXT,
  phone TEXT,
  twitter_handle TEXT,
  twitter_dm_open BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_coaches_program ON coaches(program_id);

-- ============================================
-- PIPELINE STAGES (reference table)
-- ============================================
CREATE TABLE pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL,
  description TEXT
);

-- Insert default stages
INSERT INTO pipeline_stages (name, display_order, description) VALUES
  ('Initial Contact', 1, 'Exchange communication, fill out questionnaire, connect with area recruiting coach'),
  ('Evaluation', 2, 'Coach watched film, passed to position coach'),
  ('Interest', 3, 'Coach engages, builds relationship, invites to campus, asks for more film'),
  ('Campus Visit', 4, 'Junior day, game day visit, official visit'),
  ('Offer', 5, 'Received an offer from the program'),
  ('Decision/Commit', 6, 'Athlete makes their decision');

-- ============================================
-- PIPELINE ENTRIES (per-athlete, per-program)
-- ============================================
CREATE TABLE pipeline_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES pipeline_stages(id),
  primary_coach_id UUID REFERENCES coaches(id),
  status pipeline_status NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(athlete_id, program_id)
);

CREATE INDEX idx_pipeline_athlete ON pipeline_entries(athlete_id);
CREATE INDEX idx_pipeline_program ON pipeline_entries(program_id);
CREATE INDEX idx_pipeline_stage ON pipeline_entries(stage_id);

-- ============================================
-- INTERACTIONS (activity log)
-- ============================================
CREATE TABLE interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_entry_id UUID NOT NULL REFERENCES pipeline_entries(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  coach_id UUID REFERENCES coaches(id),
  type interaction_type NOT NULL,
  direction interaction_direction NOT NULL,
  subject TEXT,
  body TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_interactions_pipeline ON interactions(pipeline_entry_id);
CREATE INDEX idx_interactions_athlete ON interactions(athlete_id);

-- ============================================
-- ACTION ITEMS
-- ============================================
CREATE TABLE action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pipeline_entry_id UUID REFERENCES pipeline_entries(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  priority action_priority NOT NULL DEFAULT 'medium',
  status action_status NOT NULL DEFAULT 'pending',
  auto_generated BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_actions_athlete ON action_items(athlete_id);
CREATE INDEX idx_actions_status ON action_items(status);

-- ============================================
-- EMAIL TEMPLATES
-- ============================================
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  stage_id UUID REFERENCES pipeline_stages(id),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id),
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default templates
INSERT INTO email_templates (name, stage_id, subject, body, is_system) VALUES
  ('Initial Introduction', (SELECT id FROM pipeline_stages WHERE display_order = 1),
   'Introduction - {{athlete_first_name}} {{athlete_last_name}} | {{position}} | Class of {{grad_year}}',
   'Dear Coach {{coach_last_name}},

My name is {{athlete_first_name}} {{athlete_last_name}} and I am a {{position}} in the Class of {{grad_year}} at {{high_school}} in {{city}}, {{state}}.

I am very interested in {{school_name}} and your football program. I would love the opportunity to learn more about your program and what it takes to be a part of your team.

Here is a link to my highlight film: {{hudl_url}}

Height: {{height}} | Weight: {{weight}} | GPA: {{gpa}}

Thank you for your time, and I look forward to hearing from you.

Sincerely,
{{athlete_first_name}} {{athlete_last_name}}',
   TRUE),

  ('Film Drop DM', (SELECT id FROM pipeline_stages WHERE display_order = 1),
   'New Film - {{athlete_first_name}} {{athlete_last_name}} | {{position}} | {{grad_year}}',
   'Coach {{coach_last_name}}, I wanted to share my latest highlights with you. I believe I can contribute to {{school_name}}. {{hudl_url}}

{{athlete_first_name}} {{athlete_last_name}} | {{position}} | Class of {{grad_year}}',
   TRUE),

  ('Follow-Up Email', (SELECT id FROM pipeline_stages WHERE display_order = 2),
   'Following Up - {{athlete_first_name}} {{athlete_last_name}} | {{position}} | Class of {{grad_year}}',
   'Dear Coach {{coach_last_name}},

I wanted to follow up on my previous email. I remain very interested in {{school_name}} and would love to discuss any opportunities to join your program.

I have been working hard this offseason and have updated film available: {{hudl_url}}

Thank you again for your time.

Best regards,
{{athlete_first_name}} {{athlete_last_name}}',
   TRUE),

  ('Camp Interest', (SELECT id FROM pipeline_stages WHERE display_order = 3),
   'Camp Registration Interest - {{athlete_first_name}} {{athlete_last_name}}',
   'Dear Coach {{coach_last_name}},

I am very interested in attending an upcoming camp at {{school_name}}. Could you provide me with information on upcoming camp dates and registration?

I would love the chance to compete in front of your coaching staff.

Thank you,
{{athlete_first_name}} {{athlete_last_name}}',
   TRUE),

  ('Post-Camp Thank You', (SELECT id FROM pipeline_stages WHERE display_order = 4),
   'Thank You - {{athlete_first_name}} {{athlete_last_name}} | Camp Visit',
   'Dear Coach {{coach_last_name}},

Thank you for the opportunity to attend camp at {{school_name}}. I had a great experience and enjoyed learning from your coaching staff.

I am more excited than ever about the possibility of being a part of your program. Please let me know if there is anything else you need from me.

Best regards,
{{athlete_first_name}} {{athlete_last_name}}',
   TRUE);

-- ============================================
-- EMAIL SENDS (tracking)
-- ============================================
CREATE TABLE email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  template_id UUID REFERENCES email_templates(id),
  coach_id UUID NOT NULL REFERENCES coaches(id),
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status email_status NOT NULL DEFAULT 'queued',
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_sends_athlete ON email_sends(athlete_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sends ENABLE ROW LEVEL SECURITY;

-- Profiles: users see own, admins see all
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "New users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Programs & Coaches: all authenticated users can read
CREATE POLICY "Authenticated users can view programs" ON programs
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage programs" ON programs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Authenticated users can view coaches" ON coaches
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage coaches" ON coaches
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Pipeline stages: all authenticated can read
CREATE POLICY "Authenticated users can view stages" ON pipeline_stages
  FOR SELECT USING (auth.role() = 'authenticated');

-- Pipeline entries: athletes see own, admins see all
CREATE POLICY "Athletes see own pipeline" ON pipeline_entries
  FOR ALL USING (
    athlete_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Interactions: athletes see own, admins see all
CREATE POLICY "Athletes see own interactions" ON interactions
  FOR ALL USING (
    athlete_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Action items: athletes see own, admins see all
CREATE POLICY "Athletes see own actions" ON action_items
  FOR ALL USING (
    athlete_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Email templates: all authenticated can read, admins can manage
CREATE POLICY "Authenticated users can view templates" ON email_templates
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage templates" ON email_templates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Email sends: athletes see own, admins see all
CREATE POLICY "Athletes see own email sends" ON email_sends
  FOR ALL USING (
    athlete_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_programs_updated_at BEFORE UPDATE ON programs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_coaches_updated_at BEFORE UPDATE ON coaches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_pipeline_entries_updated_at BEFORE UPDATE ON pipeline_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON email_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
