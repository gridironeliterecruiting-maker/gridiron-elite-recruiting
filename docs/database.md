# Database Reference

Supabase project: `ufmzldfkdpjeyvjfpoid` (us-west-2)

---

## Enums

```sql
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
```

---

## Tables

### `profiles` — Athlete user profiles (extends auth.users)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK, FK → auth.users(id) ON DELETE CASCADE |
| role | user_role | NOT NULL DEFAULT 'athlete' |
| first_name | TEXT | |
| last_name | TEXT | |
| email | TEXT | |
| phone | TEXT | |
| grad_year | INTEGER | |
| high_school | TEXT | |
| city | TEXT | |
| state | TEXT | |
| position | TEXT | |
| height | TEXT | |
| weight | INTEGER | |
| gpa | DECIMAL(3,2) | |
| hudl_url | TEXT | |
| twitter_handle | TEXT | |
| profile_image_url | TEXT | |
| can_send_emails | BOOLEAN | DEFAULT FALSE — safety gate |
| username | TEXT | (migration 012) |
| workspace_email | TEXT | jetstreammail.com address (migration 012) |
| zoho_account_key | TEXT | Per-mailbox Zoho routing key |
| is_grandfathered | BOOLEAN | Skip Stripe checkout if true |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |

### `programs` — College football programs
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| school_name | TEXT | NOT NULL |
| division | division | NOT NULL |
| conference | TEXT | |
| state | TEXT | |
| city | TEXT | |
| website | TEXT | |
| logo_url | TEXT | Self-hosted: /logos/{uuid}.png |
| espn_id | TEXT | ESPN team ID |
| rml_school_name | TEXT | Original RML name |

### `coaches` — College coaching staff
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| program_id | UUID | NOT NULL, FK → programs(id) ON DELETE CASCADE |
| first_name | TEXT | NOT NULL |
| last_name | TEXT | NOT NULL |
| title | TEXT | |
| email | TEXT | |
| phone | TEXT | |
| twitter_handle | TEXT | |
| twitter_dm_open | BOOLEAN | DEFAULT FALSE |
| is_active | BOOLEAN | NOT NULL DEFAULT TRUE — soft-delete flag |
| rml_source_key | TEXT | Dedup key for sync |

UNIQUE(program_id, first_name, last_name)
Indexes: idx_coaches_program, idx_coaches_rml_source_key, idx_coaches_is_active

### `pipeline_stages` — CRM stages (reference)
| order | name |
|-------|------|
| 1 | Initial Contact |
| 2 | Evaluation |
| 3 | Interest |
| 4 | Campus Visit |
| 5 | Offer |
| 6 | Decision/Commit |

### `pipeline_entries` — Per-athlete, per-program position
UNIQUE(athlete_id, program_id). Status: active / dead / committed.

### `interactions` — Activity log per pipeline entry
Types: email_sent, email_received, dm_sent, dm_received, call, visit, film_sent, questionnaire, camp_invite, offer, other. Direction: inbound / outbound.

### `action_items` — Athlete to-dos
Priority: low / medium / high / urgent. Status: pending / completed / dismissed.

### `email_templates`
System templates seeded in migration 002: Get a Response (4), Evaluate Film (1), Build Interest (2), Secure Visit (2), Other (1).

### `campaigns`
type: 'email' or 'dm'. status: draft / active / paused / cancelled / completed.

### `campaign_emails` — Multi-step email sequence per campaign
`send_after_days` controls delay between steps.

### `campaign_recipients`
status: pending / scheduled / sent / replied / bounced / error / unsubscribed.

### `email_events`
event_type: sent / opened / clicked / replied / bounced. metadata: JSONB.

### `email_send_log`
Stores `gmail_message_id` from Gmail API response.

### `email_sends` — Legacy (migration 001, superseded by campaigns + email_events)

### `gmail_tokens`
account_tier: new / building / established / veteran (determined by connection age + total sends).

### `twitter_tokens`
UNIQUE per user_id. Stores twitter_user_id and twitter_handle.

### `system_settings` — Key-value config
`email_sending_enabled` — kill switch ("true"/"false").

### `email_allowlist` — Approved sender emails

### `unsubscribes` — Coach email opt-outs (email + campaign_id)

### `managed_programs` — High school programs (created 2026-02-27)
Prairie Hawks: id=239fee15-9727-448d-b339-721cfa457dc4, slug=prairie-ia

### `program_members` — Coach/player associations per managed program
Coach detection uses `program_members.role`, NOT `profiles.role`.

### `access_requests` — Program access requests

---

## RLS Summary
- `profiles`: own row only; admins see all
- `programs`/`coaches`: all authenticated users can read; admins manage
- `pipeline_entries`/`interactions`/`action_items`: own rows only; admins see all
- `email_templates`: all authenticated read; admins manage

## Triggers
- `on_auth_user_created` → auto-creates profile row from auth.users metadata
- `update_*_updated_at` → auto-sets updated_at on UPDATE

---

## Query Patterns

### Always filter active coaches
```ts
.eq('is_active', true)
```
Used in: `/api/coaches/search`, `/api/programs/[id]/coaches`, dashboard coach count.

### Supabase client selection
- Browser: `createClient()` from `lib/supabase/client.ts` (anon key)
- Server Components: `createClient()` from `lib/supabase/server.ts` (cookie-based)
- API Routes (admin): `createClient()` from `lib/supabase/admin.ts` (service role)

### Scripts
Use `pg` Pool with direct SQL via `DATABASE_URL`. Not Supabase client.

---

## Migrations
| File | Contents |
|------|----------|
| 001_initial_schema.sql | Core tables, enums, RLS, triggers |
| 002_seed_system_templates.sql | System email templates |
| 003_rml_sync_columns.sql | is_active, rml_source_key |
| 004_dm_campaigns.sql | DM campaign type + columns |
| 012 (pending) | usernames, workspace_email, subscriptions, is_grandfathered |
