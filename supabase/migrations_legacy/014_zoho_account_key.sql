-- Add zoho_account_key to profiles
-- This stores the Zoho Mail360 per-mailbox key returned on provisioning.
-- Used to route all inbox/send/delete API calls without per-user OAuth.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS zoho_account_key TEXT;
