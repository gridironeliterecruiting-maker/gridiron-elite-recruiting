-- Runway Recruit — Local-dev seed data
-- Applied automatically by `supabase db reset` after migrations finish.
-- Populates a moderate volume of synthetic test data so developers can exercise
-- the full app flow locally without ever touching production data.
--
-- Hard rules baked in:
--   * ALL emails use @example.test (reserved for testing — cannot escape to real inboxes)
--   * ALL names are obviously fake (Coach Smith1, Athlete Demo, Fake University)
--   * Every seeded coach carries cc_source_key = 'local-seed-*', so the protected-
--     test-coach safeguard (NULL source keys only) never treats them as user-added.
--   * email_sending_enabled system setting is hard-forced to 'false' in 002, so
--     even if a dev triggers a send path, no mail actually leaves the box.
--
-- Login credentials (all share password 'password123'):
--   admin@example.test     — role=admin
--   athlete1@example.test  — role=athlete (full profile, lives in seed campaigns)
--   athlete2@example.test  — role=athlete (sparse profile, second-athlete sanity)
--   coach1@example.test    — role=coach  (program-member on Fake University)

-- ================================================================
-- TEST USERS (auth.users + auth.identities → trigger creates profiles)
-- ================================================================
-- crypt/gen_salt live in the pgcrypto extension which Supabase auto-installs.
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  is_sso_user, is_anonymous
) VALUES
  ('00000000-0000-0000-0000-000000000000'::uuid,
   '00000000-0000-0000-0000-000000000001'::uuid,
   'authenticated', 'authenticated',
   'admin@example.test',
   crypt('password123', gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"first_name":"Admin","last_name":"Demo"}'::jsonb,
   false, false),
  ('00000000-0000-0000-0000-000000000000'::uuid,
   '00000000-0000-0000-0000-000000000002'::uuid,
   'authenticated', 'authenticated',
   'athlete1@example.test',
   crypt('password123', gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"first_name":"Alex","last_name":"Athlete"}'::jsonb,
   false, false),
  ('00000000-0000-0000-0000-000000000000'::uuid,
   '00000000-0000-0000-0000-000000000003'::uuid,
   'authenticated', 'authenticated',
   'athlete2@example.test',
   crypt('password123', gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"first_name":"Sam","last_name":"Seed"}'::jsonb,
   false, false),
  ('00000000-0000-0000-0000-000000000000'::uuid,
   '00000000-0000-0000-0000-000000000004'::uuid,
   'authenticated', 'authenticated',
   'coach1@example.test',
   crypt('password123', gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"first_name":"Casey","last_name":"Coach"}'::jsonb,
   false, false);

-- GoTrue's user scanner rejects NULL token/email-change fields (it scans them as
-- Go strings, not pointers). The columns default to NULL when unspecified, so
-- force them to '' before any login attempt.
UPDATE auth.users SET
  confirmation_token         = COALESCE(confirmation_token, ''),
  recovery_token             = COALESCE(recovery_token, ''),
  email_change_token_new     = COALESCE(email_change_token_new, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  email_change               = COALESCE(email_change, ''),
  reauthentication_token     = COALESCE(reauthentication_token, ''),
  phone_change               = COALESCE(phone_change, ''),
  phone_change_token         = COALESCE(phone_change_token, '')
WHERE id IN (
  '00000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000003'::uuid,
  '00000000-0000-0000-0000-000000000004'::uuid
);

-- Each user needs a matching auth.identities row for email/password sign-in.
INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT u.id::text, u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
       'email', now(), now(), now()
FROM auth.users u
WHERE u.id IN (
  '00000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000003'::uuid,
  '00000000-0000-0000-0000-000000000004'::uuid
);

-- Trigger on_auth_user_created fired above and created rows in public.profiles
-- with default role='athlete'. Upgrade the two non-athletes and fill extended
-- profile fields so pages that show athlete-specific data actually render.
UPDATE public.profiles SET role = 'admin'
  WHERE id = '00000000-0000-0000-0000-000000000001'::uuid;
UPDATE public.profiles SET role = 'coach'
  WHERE id = '00000000-0000-0000-0000-000000000004'::uuid;

UPDATE public.profiles SET
  phone = '555-0102', grad_year = 2027, high_school = 'Demo High School',
  city = 'Testville', state = 'IA', position = 'Quarterback',
  height = '6''2"', weight = 195, gpa = 3.80,
  hudl_url = 'https://www.hudl.com/profile/test-alex',
  twitter_handle = 'AlexAthleteTest',
  username = 'alex-athlete', jersey_number = '7',
  can_send_emails = true, is_grandfathered = true,
  title = 'Class of 2027'
WHERE id = '00000000-0000-0000-0000-000000000002'::uuid;

UPDATE public.profiles SET
  phone = '555-0103', grad_year = 2028, high_school = 'Demo High School',
  city = 'Testville', state = 'IA', position = 'Wide Receiver',
  height = '6''0"', weight = 180, gpa = 3.50,
  username = 'sam-seed',
  can_send_emails = true, is_grandfathered = true
WHERE id = '00000000-0000-0000-0000-000000000003'::uuid;

-- ================================================================
-- FAKE PROGRAMS (5) — replaces the prior real-school sample
-- ================================================================
-- School-name uniqueness not enforced in schema; the prior seed already inserted
-- 10 real-school rows earlier in this same file (now removed). Nothing to delete.
INSERT INTO public.programs (id, school_name, division, conference, state, city, rml_school_name, twitter_handle) VALUES
  ('11111111-1111-1111-1111-111111111101'::uuid, 'Fake University',   'FBS',  'Pretend Conference',  'IA', 'Testville',      'fake-university', 'FakeUFootball'),
  ('11111111-1111-1111-1111-111111111102'::uuid, 'Example State',     'FBS',  'Example Conference',  'MN', 'Mocktown',       'example-state',   'ExampleStateFB'),
  ('11111111-1111-1111-1111-111111111103'::uuid, 'Mock College',      'FCS',  'Demo Valley',         'WI', 'Seedville',      'mock-college',    'MockCollegeFB'),
  ('11111111-1111-1111-1111-111111111104'::uuid, 'Placeholder U',     'DIII', 'Placeholder Athletic Conference', 'NE', 'Dummyburg', 'placeholder-u', 'PlaceholderU'),
  ('11111111-1111-1111-1111-111111111105'::uuid, 'Dummy Tech',        'NAIA', 'Stub Athletic Association', 'SD', 'Faketown',    'dummy-tech',      'DummyTechFB');

-- ================================================================
-- FAKE COACHES (50 — 10 per program)
-- ================================================================
-- generate_series gives us the staff list without 50 hand-typed rows.
-- cc_source_key is populated so the "protected test coaches" safeguard
-- (NULL source keys only) never treats seeded coaches as user-added.
INSERT INTO public.coaches (program_id, first_name, last_name, title, email, twitter_handle, cc_source_key)
SELECT
  p.id,
  'Coach',
  'Smith' || n,
  CASE n WHEN 1 THEN 'Head Coach'
         WHEN 2 THEN 'Offensive Coordinator'
         WHEN 3 THEN 'Defensive Coordinator'
         WHEN 4 THEN 'Quarterbacks Coach'
         WHEN 5 THEN 'Running Backs Coach'
         WHEN 6 THEN 'Wide Receivers Coach'
         WHEN 7 THEN 'Offensive Line Coach'
         WHEN 8 THEN 'Defensive Line Coach'
         WHEN 9 THEN 'Linebackers Coach'
         WHEN 10 THEN 'Defensive Backs Coach'
    END,
  'coach' || n || '.' || p.rml_school_name || '@example.test',
  'Coach' || n || replace(initcap(p.rml_school_name), '-', ''),
  'local-seed-' || p.rml_school_name || '-' || n
FROM public.programs p
CROSS JOIN generate_series(1, 10) AS gs(n)
WHERE p.id IN (
  '11111111-1111-1111-1111-111111111101'::uuid,
  '11111111-1111-1111-1111-111111111102'::uuid,
  '11111111-1111-1111-1111-111111111103'::uuid,
  '11111111-1111-1111-1111-111111111104'::uuid,
  '11111111-1111-1111-1111-111111111105'::uuid
);

-- ================================================================
-- PIPELINE ENTRIES — athlete1 targeting 4 programs at various stages
-- ================================================================
INSERT INTO public.pipeline_entries (athlete_id, program_id, stage_id, primary_coach_id, notes) VALUES
  ('00000000-0000-0000-0000-000000000002'::uuid,
   '11111111-1111-1111-1111-111111111101'::uuid,
   '67dbab91-6ec6-418c-964c-af943f7b8cc9'::uuid,  -- Campus Visit
   (SELECT id FROM public.coaches WHERE program_id = '11111111-1111-1111-1111-111111111101'::uuid AND title = 'Head Coach' LIMIT 1),
   'Took an unofficial visit last weekend. Waiting on offer decision.'),
  ('00000000-0000-0000-0000-000000000002'::uuid,
   '11111111-1111-1111-1111-111111111102'::uuid,
   '6dd80536-731a-4c18-8f0c-0f791c1d278f'::uuid,  -- Interest
   (SELECT id FROM public.coaches WHERE program_id = '11111111-1111-1111-1111-111111111102'::uuid AND title = 'Quarterbacks Coach' LIMIT 1),
   'QB coach texted after film review. Weekly check-ins.'),
  ('00000000-0000-0000-0000-000000000002'::uuid,
   '11111111-1111-1111-1111-111111111103'::uuid,
   '79ece3cb-2de0-4bc9-9c6d-12f09a370ac2'::uuid,  -- Offer
   (SELECT id FROM public.coaches WHERE program_id = '11111111-1111-1111-1111-111111111103'::uuid AND title = 'Head Coach' LIMIT 1),
   'First offer — verbal, extended on campus.'),
  ('00000000-0000-0000-0000-000000000002'::uuid,
   '11111111-1111-1111-1111-111111111104'::uuid,
   '465322aa-2949-4b82-8f5b-e2b694f8f8df'::uuid,  -- Initial Contact
   NULL,
   'Sent intro email last week. No response yet.');

-- ================================================================
-- CAMPAIGN — 1 active email campaign owned by athlete1
-- ================================================================
INSERT INTO public.campaigns (id, user_id, name, goal, status, type, created_at, updated_at) VALUES
  ('44444444-4444-4444-4444-444444444401'::uuid,
   '00000000-0000-0000-0000-000000000002'::uuid,
   'Summer 2026 Outreach',
   'Get on the radar for schools in the Midwest before fall camps.',
   'active', 'email',
   now() - interval '21 days', now() - interval '1 day');

-- ================================================================
-- CAMPAIGN RECIPIENTS — 10 coaches (two from each of the 5 programs)
-- ================================================================
WITH picks AS (
  SELECT id AS coach_id, first_name, last_name, email,
         (SELECT school_name FROM public.programs WHERE id = c.program_id) AS program_name,
         twitter_handle,
         row_number() OVER (PARTITION BY c.program_id ORDER BY c.email) AS rn
  FROM public.coaches c
  WHERE c.cc_source_key LIKE 'local-seed-%'
)
INSERT INTO public.campaign_recipients (
  id, campaign_id, coach_id, coach_name, coach_email, program_name,
  current_step, status, twitter_handle, created_at, sent_at, opened_at
)
SELECT
  ('55555555-5555-5555-5555-5555555555' || lpad((row_number() OVER (ORDER BY program_name, rn))::text, 2, '0'))::uuid,
  '44444444-4444-4444-4444-444444444401'::uuid,
  coach_id,
  first_name || ' ' || last_name,
  email,
  program_name,
  1, 'sent',
  twitter_handle,
  now() - interval '20 days',
  now() - interval '14 days',
  -- Half the recipients also "opened" the email (rn=1 picks of each program)
  CASE WHEN rn = 1 THEN now() - interval '13 days' ELSE NULL END
FROM picks
WHERE rn <= 2
ORDER BY program_name, rn;

-- ================================================================
-- EMAIL EVENTS — populate campaign_clean_stats (sent/opened/clicked/replied)
-- ================================================================
-- 10 'sent' events, 5 'opened', 3 'clicked', 1 'replied'. Matches the shape
-- of the recipients above (rn=1 picks opened; the "first pick overall" clicked
-- and replied). Everything obeys scanner_flagged_at = NULL so it all counts.
INSERT INTO public.email_events (campaign_id, recipient_id, event_type, created_at)
SELECT
  cr.campaign_id, cr.id, 'sent', cr.sent_at
FROM public.campaign_recipients cr
WHERE cr.campaign_id = '44444444-4444-4444-4444-444444444401'::uuid;

INSERT INTO public.email_events (campaign_id, recipient_id, event_type, created_at)
SELECT
  cr.campaign_id, cr.id, 'opened', cr.opened_at
FROM public.campaign_recipients cr
WHERE cr.campaign_id = '44444444-4444-4444-4444-444444444401'::uuid
  AND cr.opened_at IS NOT NULL;

-- Three of the opens escalated to clicks.
INSERT INTO public.email_events (campaign_id, recipient_id, event_type, created_at)
SELECT
  cr.campaign_id, cr.id, 'clicked', cr.opened_at + interval '3 minutes'
FROM public.campaign_recipients cr
WHERE cr.campaign_id = '44444444-4444-4444-4444-444444444401'::uuid
  AND cr.opened_at IS NOT NULL
ORDER BY cr.program_name
LIMIT 3;

-- One reply — from the first recipient in alphabetical program order.
INSERT INTO public.email_events (campaign_id, recipient_id, event_type, created_at)
SELECT
  cr.campaign_id, cr.id, 'replied', cr.opened_at + interval '2 days'
FROM public.campaign_recipients cr
WHERE cr.campaign_id = '44444444-4444-4444-4444-444444444401'::uuid
  AND cr.opened_at IS NOT NULL
ORDER BY cr.program_name
LIMIT 1;

-- Also flip that recipient's status = 'replied' so per-recipient rollups match.
UPDATE public.campaign_recipients SET status = 'replied'
WHERE id = (
  SELECT cr.id FROM public.campaign_recipients cr
  WHERE cr.campaign_id = '44444444-4444-4444-4444-444444444401'::uuid
    AND cr.opened_at IS NOT NULL
  ORDER BY cr.program_name
  LIMIT 1
);

-- ================================================================
-- EMAIL ALLOWLIST — permit the 3 athlete/admin accounts to send
-- ================================================================
INSERT INTO public.email_allowlist (email, note) VALUES
  ('admin@example.test',    'Seeded admin — local dev only'),
  ('athlete1@example.test', 'Seeded athlete — local dev only'),
  ('athlete2@example.test', 'Seeded athlete — local dev only');
