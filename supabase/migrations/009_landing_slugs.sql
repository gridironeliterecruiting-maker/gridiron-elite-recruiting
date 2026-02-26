-- ============================================
-- 009: Landing Slugs for Branded Login Pages
-- Adds landing_slug to coach_profiles for custom URLs like /prairie-ia
-- ============================================

-- Add landing_slug column (unique, nullable)
ALTER TABLE coach_profiles ADD COLUMN landing_slug TEXT UNIQUE;

-- Allow unauthenticated reads of coach_profiles by landing_slug
-- (needed for branded login pages before the user is signed in)
CREATE POLICY "Anyone can view coach_profiles by landing_slug" ON coach_profiles
  FOR SELECT USING (landing_slug IS NOT NULL);
