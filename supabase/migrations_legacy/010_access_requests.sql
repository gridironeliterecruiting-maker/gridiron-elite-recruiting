-- Access requests for branded program pages
-- When an unauthorized user signs in on a program landing page,
-- they can request access. The program coach gets notified.

CREATE TABLE access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  user_name TEXT,
  coach_profile_id UUID NOT NULL REFERENCES coach_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'approved', 'denied'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, coach_profile_id)
);

-- RLS
ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;

-- Coaches can see requests for their program
CREATE POLICY "Coaches can view their access requests"
  ON access_requests FOR SELECT
  USING (coach_profile_id = auth.uid());

-- Coaches can update request status
CREATE POLICY "Coaches can update their access requests"
  ON access_requests FOR UPDATE
  USING (coach_profile_id = auth.uid());

-- Users can insert their own requests
CREATE POLICY "Users can create access requests"
  ON access_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can see their own requests
CREATE POLICY "Users can view their own requests"
  ON access_requests FOR SELECT
  USING (user_id = auth.uid());
