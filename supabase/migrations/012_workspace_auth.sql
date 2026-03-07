-- 012_workspace_auth.sql
-- Adds Google Workspace email provisioning + Stripe subscription tracking

-- Add workspace + stripe fields to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS username TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS workspace_email TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS recovery_email TEXT,
  ADD COLUMN IF NOT EXISTS jersey_number TEXT,
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS is_grandfathered BOOLEAN NOT NULL DEFAULT FALSE;

-- Grandfather all existing users so they skip the checkout gate
UPDATE profiles SET is_grandfathered = TRUE WHERE is_grandfathered = FALSE;

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'inactive',  -- active, past_due, canceled, incomplete
  plan TEXT,                                 -- monthly | annual
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own subscription" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can see all subscriptions
CREATE POLICY "Admins manage subscriptions" ON subscriptions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );
