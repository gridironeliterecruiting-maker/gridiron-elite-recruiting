-- Gridiron Elite Recruiting — Seed Data
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- ============================================
-- FIX RLS INFINITE RECURSION
-- The "Admins can view all profiles" policy references profiles itself,
-- causing infinite recursion. Replace it with a non-recursive version.
-- ============================================
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Also fix programs admin policy
DROP POLICY IF EXISTS "Admins can manage programs" ON programs;
CREATE POLICY "Admins can manage programs" ON programs
  FOR ALL USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Fix coaches admin policy
DROP POLICY IF EXISTS "Admins can manage coaches" ON coaches;
CREATE POLICY "Admins can manage coaches" ON coaches
  FOR ALL USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Fix other admin policies
DROP POLICY IF EXISTS "Admins can manage templates" ON email_templates;
CREATE POLICY "Admins can manage templates" ON email_templates
  FOR ALL USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- ============================================
-- SEED PROGRAMS
-- ============================================
INSERT INTO programs (school_name, division, conference, state, city, logo_url) VALUES
  ('Iowa', 'FBS', 'Big Ten', 'IA', 'Iowa City', 'https://a.espncdn.com/i/teamlogos/ncaa/500/2294.png'),
  ('Iowa State', 'FBS', 'Big 12', 'IA', 'Ames', 'https://a.espncdn.com/i/teamlogos/ncaa/500/66.png'),
  ('Northern Iowa', 'FCS', 'Missouri Valley', 'IA', 'Cedar Falls', 'https://a.espncdn.com/i/teamlogos/ncaa/500/2460.png'),
  ('Alabama', 'FBS', 'SEC', 'AL', 'Tuscaloosa', 'https://a.espncdn.com/i/teamlogos/ncaa/500/333.png'),
  ('Ohio State', 'FBS', 'Big Ten', 'OH', 'Columbus', 'https://a.espncdn.com/i/teamlogos/ncaa/500/194.png'),
  ('Coe College', 'DIII', 'American Rivers', 'IA', 'Cedar Rapids', NULL),
  ('Nebraska', 'FBS', 'Big Ten', 'NE', 'Lincoln', 'https://a.espncdn.com/i/teamlogos/ncaa/500/158.png'),
  ('Minnesota', 'FBS', 'Big Ten', 'MN', 'Minneapolis', 'https://a.espncdn.com/i/teamlogos/ncaa/500/135.png'),
  ('South Dakota State', 'FCS', 'Missouri Valley', 'SD', 'Brookings', 'https://a.espncdn.com/i/teamlogos/ncaa/500/2571.png'),
  ('Grand View University', 'NAIA', 'Heart of America', 'IA', 'Des Moines', NULL)
ON CONFLICT DO NOTHING;

-- ============================================
-- SEED COACHES
-- ============================================

-- Iowa coaches
INSERT INTO coaches (program_id, first_name, last_name, title, email, twitter_handle) VALUES
  ((SELECT id FROM programs WHERE school_name = 'Iowa'), 'Kirk', 'Ferentz', 'Head Coach', 'kirk-ferentz@hawkeyefootball.com', '@CoachFerentz'),
  ((SELECT id FROM programs WHERE school_name = 'Iowa'), 'Phil', 'Parker', 'Defensive Coordinator', 'phil-parker@hawkeyefootball.com', NULL),
  ((SELECT id FROM programs WHERE school_name = 'Iowa'), 'Seth', 'Wallace', 'Linebackers Coach', NULL, NULL);

-- Iowa State coaches
INSERT INTO coaches (program_id, first_name, last_name, title, email, twitter_handle) VALUES
  ((SELECT id FROM programs WHERE school_name = 'Iowa State'), 'Matt', 'Campbell', 'Head Coach', 'matt-campbell@cyclones.com', '@Coach_MCampbell'),
  ((SELECT id FROM programs WHERE school_name = 'Iowa State'), 'Nate', 'Scheelhaase', 'Offensive Coordinator', 'nate-scheelhaase@cyclones.com', NULL);

-- Northern Iowa
INSERT INTO coaches (program_id, first_name, last_name, title, email) VALUES
  ((SELECT id FROM programs WHERE school_name = 'Northern Iowa'), 'Mark', 'Farley', 'Head Coach', 'mark-farley@uni.edu');

-- Alabama
INSERT INTO coaches (program_id, first_name, last_name, title, email, twitter_handle) VALUES
  ((SELECT id FROM programs WHERE school_name = 'Alabama'), 'Kalen', 'DeBoer', 'Head Coach', 'kalen-deboer@ua.edu', '@KalenDeBoer');

-- Ohio State
INSERT INTO coaches (program_id, first_name, last_name, title, email, twitter_handle) VALUES
  ((SELECT id FROM programs WHERE school_name = 'Ohio State'), 'Ryan', 'Day', 'Head Coach', 'ryan-day@osu.edu', '@ryandaytime');

-- Coe College
INSERT INTO coaches (program_id, first_name, last_name, title, email) VALUES
  ((SELECT id FROM programs WHERE school_name = 'Coe College'), 'Tyler', 'Staker', 'Head Coach', 'tyler-staker@coe.edu');

-- Nebraska
INSERT INTO coaches (program_id, first_name, last_name, title, email, twitter_handle) VALUES
  ((SELECT id FROM programs WHERE school_name = 'Nebraska'), 'Matt', 'Rhule', 'Head Coach', 'matt-rhule@huskers.com', '@CoachMattRhule');

-- Minnesota
INSERT INTO coaches (program_id, first_name, last_name, title, email, twitter_handle) VALUES
  ((SELECT id FROM programs WHERE school_name = 'Minnesota'), 'P.J.', 'Fleck', 'Head Coach', 'pj-fleck@umn.edu', '@Coach_Fleck');

-- South Dakota State
INSERT INTO coaches (program_id, first_name, last_name, title) VALUES
  ((SELECT id FROM programs WHERE school_name = 'South Dakota State'), 'Jimmy', 'Rogers', 'Head Coach');

-- Grand View University
INSERT INTO coaches (program_id, first_name, last_name, title) VALUES
  ((SELECT id FROM programs WHERE school_name = 'Grand View University'), 'Joe', 'Woodley', 'Head Coach');
