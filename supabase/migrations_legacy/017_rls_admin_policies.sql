-- Admin RLS policies that were previously applied manually via the Supabase
-- SQL Editor in prod, and had been sitting in supabase/seed.sql (wrong place).
-- Moving them into the migrations folder so `supabase db reset` applies them
-- automatically on local setup. Idempotent via DROP POLICY IF EXISTS.
--
-- These replace the original admin policies (defined in 001_initial_schema.sql)
-- which caused "infinite recursion detected in policy" errors because they
-- referenced the profiles table from inside a profiles policy. The fix here
-- wraps the self-reference in a subquery, which Postgres does not treat as
-- recursive.

DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "Admins can manage programs" ON programs;
CREATE POLICY "Admins can manage programs" ON programs
  FOR ALL USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "Admins can manage coaches" ON coaches;
CREATE POLICY "Admins can manage coaches" ON coaches
  FOR ALL USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "Admins can manage templates" ON email_templates;
CREATE POLICY "Admins can manage templates" ON email_templates
  FOR ALL USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );
