-- ============================================================
-- Runway Prep — Database Schema
-- Supabase project: runway-elite-prep (ugkqwmlvntwkjkgdjrxf)
-- Single-user model: each auth.users row IS the athlete
-- ============================================================

create extension if not exists "uuid-ossp";

-- ──────────────────────────────────────────────────────────────
-- PROFILES
-- ──────────────────────────────────────────────────────────────
create table profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  email               text,
  first_name          text,
  last_name           text,
  position            text,
  grad_year           int,
  jersey_number       text,
  high_school         text,
  city                text,
  state               text,
  gpa                 numeric(3,2),
  height              text,
  weight              int,
  role                text not null default 'athlete' check (role in ('athlete', 'admin')),
  twitter_handle      text,
  hudl_url            text,
  readiness_score_open boolean not null default true,
  workspace_email     text,
  zoho_account_key    text,
  stripe_customer_id  text,
  can_send_emails     boolean not null default false,
  is_grandfathered    boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Users can read own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = id);

-- ──────────────────────────────────────────────────────────────
-- SUBSCRIPTIONS
-- ──────────────────────────────────────────────────────────────
create table subscriptions (
  id                     uuid primary key default uuid_generate_v4(),
  user_id                uuid not null references profiles(id) on delete cascade,
  stripe_customer_id     text,
  stripe_subscription_id text unique,
  status                 text not null default 'inactive',
  current_period_end     timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (user_id)
);

alter table subscriptions enable row level security;

create policy "Users can read own subscription"
  on subscriptions for select using (user_id = auth.uid());

-- ──────────────────────────────────────────────────────────────
-- TWITTER TOKENS
-- ──────────────────────────────────────────────────────────────
create table twitter_tokens (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null references profiles(id) on delete cascade,
  twitter_handle text,
  access_token   text,
  refresh_token  text,
  token_secret   text,
  expires_at     timestamptz,
  created_at     timestamptz not null default now(),
  unique (user_id)
);

alter table twitter_tokens enable row level security;

create policy "Users can manage own twitter token"
  on twitter_tokens for all using (user_id = auth.uid());

-- ──────────────────────────────────────────────────────────────
-- X PARTNER PROFILES (Twitter accounts athlete follows/tracks)
-- ──────────────────────────────────────────────────────────────
create table x_partner_profiles (
  id                uuid primary key default uuid_generate_v4(),
  athlete_id        uuid not null references profiles(id) on delete cascade,
  twitter_handle    text not null,
  display_name      text,
  profile_image_url text,
  created_at        timestamptz not null default now(),
  unique (athlete_id, twitter_handle)
);

alter table x_partner_profiles enable row level security;

create policy "Users can manage own x partner profiles"
  on x_partner_profiles for all using (athlete_id = auth.uid());

-- ──────────────────────────────────────────────────────────────
-- FILED EMAILS (inbox emails organized into folders)
-- ──────────────────────────────────────────────────────────────
create table filed_emails (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null references profiles(id) on delete cascade,
  gmail_message_id text,
  thread_id        text,
  from_name        text,
  from_email       text,
  coach_name       text,
  coach_id         uuid,
  program_name     text,
  program_id       uuid,
  subject          text,
  snippet          text,
  received_at      timestamptz,
  filed_at         timestamptz not null default now(),
  division         text,
  conference       text
);

alter table filed_emails enable row level security;

create policy "Users can manage own filed emails"
  on filed_emails for all using (user_id = auth.uid());

create index filed_emails_user_id_idx on filed_emails(user_id);

-- ──────────────────────────────────────────────────────────────
-- SYSTEM SETTINGS (key-value store for admin toggles)
-- ──────────────────────────────────────────────────────────────
create table system_settings (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);

-- Insert defaults
insert into system_settings (key, value) values
  ('email_sending_enabled', 'false');

-- ──────────────────────────────────────────────────────────────
-- EMAIL ALLOWLIST (safeguard: only these senders can send)
-- ──────────────────────────────────────────────────────────────
create table email_allowlist (
  id         uuid primary key default uuid_generate_v4(),
  email      text not null unique,
  created_at timestamptz not null default now()
);

-- ──────────────────────────────────────────────────────────────
-- AUTO-UPDATE updated_at
-- ──────────────────────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on profiles
  for each row execute function update_updated_at();

create trigger subscriptions_updated_at before update on subscriptions
  for each row execute function update_updated_at();
