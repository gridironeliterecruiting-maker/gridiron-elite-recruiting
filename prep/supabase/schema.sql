-- ============================================================
-- Runway Elite Prep — Database Schema
-- New Supabase project (separate from recruiting DB)
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ──────────────────────────────────────────────────────────────
-- PROFILES (parent accounts — extends auth.users)
-- ──────────────────────────────────────────────────────────────
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  first_name   text,
  last_name    text,
  phone        text,
  role         text not null default 'parent' check (role in ('parent', 'athlete', 'admin')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Users can read own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can upsert own profile"
  on profiles for all using (auth.uid() = id);

-- ──────────────────────────────────────────────────────────────
-- ATHLETES (linked to parent)
-- ──────────────────────────────────────────────────────────────
create table athletes (
  id           uuid primary key default uuid_generate_v4(),
  parent_id    uuid not null references profiles(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null, -- set when athlete creates own login
  first_name   text not null,
  last_name    text not null,
  sport        text not null default 'football',
  position     text,
  grad_year    int,
  gpa          numeric(3,2),
  bio          text,
  twitter_handle text,
  instagram_handle text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table athletes enable row level security;

create policy "Parents can manage their athletes"
  on athletes for all using (parent_id = auth.uid());

create policy "Athletes can read their own record"
  on athletes for select using (auth_user_id = auth.uid());

-- ──────────────────────────────────────────────────────────────
-- SUBSCRIPTIONS (Stripe state per family)
-- ──────────────────────────────────────────────────────────────
create table subscriptions (
  id                     uuid primary key default uuid_generate_v4(),
  user_id                uuid not null references profiles(id) on delete cascade,
  stripe_customer_id     text,
  stripe_subscription_id text,
  plan                   text not null default 'free' check (plan in ('free', 'starter', 'pro', 'elite')),
  status                 text not null default 'inactive' check (status in ('active', 'inactive', 'canceled', 'past_due')),
  current_period_end     timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (user_id)
);

alter table subscriptions enable row level security;

create policy "Users can read own subscription"
  on subscriptions for select using (user_id = auth.uid());

-- ──────────────────────────────────────────────────────────────
-- CONNECTIONS (exposure pipeline entries)
-- ──────────────────────────────────────────────────────────────
create table connections (
  id              uuid primary key default uuid_generate_v4(),
  parent_id       uuid not null references profiles(id) on delete cascade,
  type            text not null check (type in ('hs_coach', 'camp', 'travel_team', 'other')),
  name            text not null,
  organization    text,
  title           text,
  email           text,
  phone           text,
  location        text,
  notes           text,
  status          text not null default 'identified'
                    check (status in ('identified', 'contacted', 'connected', 'visited', 'committed')),
  last_contact_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table connections enable row level security;

create policy "Parents can manage their connections"
  on connections for all using (parent_id = auth.uid());

create index connections_parent_id_idx on connections(parent_id);
create index connections_status_idx on connections(status);

-- ──────────────────────────────────────────────────────────────
-- CONNECTION INTERACTIONS (touchpoints per connection)
-- ──────────────────────────────────────────────────────────────
create table connection_interactions (
  id             uuid primary key default uuid_generate_v4(),
  connection_id  uuid not null references connections(id) on delete cascade,
  type           text not null check (type in ('email', 'call', 'meeting', 'visit', 'social', 'note')),
  notes          text,
  occurred_at    timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

alter table connection_interactions enable row level security;

create policy "Parents can manage interactions via connection ownership"
  on connection_interactions for all
  using (
    exists (
      select 1 from connections c
      where c.id = connection_id and c.parent_id = auth.uid()
    )
  );

create index connection_interactions_connection_id_idx on connection_interactions(connection_id);

-- ──────────────────────────────────────────────────────────────
-- MEASURABLES (athletic benchmarks over time)
-- ──────────────────────────────────────────────────────────────
create table measurables (
  id           uuid primary key default uuid_generate_v4(),
  athlete_id   uuid not null references athletes(id) on delete cascade,
  metric       text not null, -- '40_time', 'vertical', 'bench', 'height', 'weight', etc.
  value        numeric not null,
  unit         text,          -- 'seconds', 'inches', 'lbs', etc.
  recorded_at  timestamptz not null default now(),
  notes        text,
  created_at   timestamptz not null default now()
);

alter table measurables enable row level security;

create policy "Parents can manage athlete measurables"
  on measurables for all
  using (
    exists (
      select 1 from athletes a
      where a.id = athlete_id and a.parent_id = auth.uid()
    )
  );

-- ──────────────────────────────────────────────────────────────
-- SOCIAL GOALS (brand building milestones)
-- ──────────────────────────────────────────────────────────────
create table social_goals (
  id           uuid primary key default uuid_generate_v4(),
  athlete_id   uuid not null references athletes(id) on delete cascade,
  platform     text not null check (platform in ('twitter', 'instagram', 'tiktok', 'hudl', 'other')),
  goal_type    text not null, -- 'followers', 'posts', 'highlight_views', etc.
  target       int,
  current      int default 0,
  due_date     date,
  completed    boolean default false,
  notes        text,
  created_at   timestamptz not null default now()
);

alter table social_goals enable row level security;

create policy "Parents can manage social goals"
  on social_goals for all
  using (
    exists (
      select 1 from athletes a
      where a.id = athlete_id and a.parent_id = auth.uid()
    )
  );

-- ──────────────────────────────────────────────────────────────
-- TASKS (task library — sport-specific)
-- ──────────────────────────────────────────────────────────────
create table tasks (
  id           uuid primary key default uuid_generate_v4(),
  title        text not null,
  description  text,
  category     text not null check (category in ('training', 'academic', 'exposure', 'mindset')),
  sport        text default 'all', -- 'all', 'football', 'baseball', etc.
  duration_min int,               -- estimated minutes
  is_library   boolean default true, -- library tasks vs custom
  created_by   uuid references profiles(id),
  created_at   timestamptz not null default now()
);

-- ──────────────────────────────────────────────────────────────
-- ATHLETE TASKS (assigned tasks per athlete)
-- ──────────────────────────────────────────────────────────────
create table athlete_tasks (
  id           uuid primary key default uuid_generate_v4(),
  athlete_id   uuid not null references athletes(id) on delete cascade,
  task_id      uuid references tasks(id) on delete set null,
  title        text not null, -- denormalized in case task is deleted
  category     text not null,
  due_date     date,
  recurrence   text check (recurrence in ('once', 'daily', 'weekly')),
  assigned_by  uuid references profiles(id),
  created_at   timestamptz not null default now()
);

alter table athlete_tasks enable row level security;

create policy "Parents can manage athlete tasks"
  on athlete_tasks for all
  using (
    exists (
      select 1 from athletes a
      where a.id = athlete_id and a.parent_id = auth.uid()
    )
  );

-- ──────────────────────────────────────────────────────────────
-- TASK COMPLETIONS (athlete check-in responses)
-- ──────────────────────────────────────────────────────────────
create table task_completions (
  id              uuid primary key default uuid_generate_v4(),
  athlete_task_id uuid not null references athlete_tasks(id) on delete cascade,
  completed_at    timestamptz not null default now(),
  notes           text,
  effort_rating   int check (effort_rating between 1 and 5)
);

alter table task_completions enable row level security;

create policy "Parents and athletes can manage completions"
  on task_completions for all
  using (
    exists (
      select 1 from athlete_tasks at2
      join athletes a on a.id = at2.athlete_id
      where at2.id = athlete_task_id
        and (a.parent_id = auth.uid() or a.auth_user_id = auth.uid())
    )
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

create trigger athletes_updated_at before update on athletes
  for each row execute function update_updated_at();

create trigger subscriptions_updated_at before update on subscriptions
  for each row execute function update_updated_at();

create trigger connections_updated_at before update on connections
  for each row execute function update_updated_at();
