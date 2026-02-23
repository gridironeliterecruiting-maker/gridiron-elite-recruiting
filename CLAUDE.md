# Gridiron Elite Recruiting — Comprehensive Codebase Reference

> **Living document** for AI assistants (Claude Code, Claude.ai) to understand the full project.
> Last updated: 2026-02-22

---

## 1. Project Overview

**Gridiron Elite Recruiting** is a SaaS platform that helps high school football athletes manage their college recruiting outreach. Athletes can browse college programs and coaches, send personalized email/DM campaigns, track interactions in a CRM pipeline, and monitor engagement analytics.

### Tech Stack
| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.1.6 (App Router) |
| Language | TypeScript 5.9.3 |
| UI | React 19.2.3, Tailwind CSS 3.4, shadcn/ui (60+ Radix components) |
| Backend | Supabase (PostgreSQL, Auth, RLS) |
| Email | Gmail API (OAuth2, send + read) |
| Auth | Google OAuth via Supabase Auth |
| Hosting | Vercel (production + preview) |
| Icons | Lucide React |
| Charts | Recharts |
| Forms | React Hook Form + Zod validation |
| Scraping | Playwright (coach data from RML) |
| CI/CD | GitHub Actions (bi-weekly coach sync) |

### Architecture
- **Monorepo-style layout** — app code in `/app/`, data scripts in `/scripts/`
- No root `package.json` — each directory has its own
- Server Components for data fetching, Client Components for interactivity
- Supabase service-role client for API routes, anon client for browser
- All email sending goes through Gmail API (not SMTP)

---

## 2. Directory Structure

```
gridiron-elite-recruiting/
├── app/                          # Next.js application
│   ├── package.json              # App dependencies
│   ├── next.config.ts            # Next.js config (minimal)
│   ├── tailwind.config.ts        # Tailwind + custom theme
│   ├── tsconfig.json
│   ├── public/
│   │   └── logos/                # ~690 self-hosted program logos (UUID.png)
│   └── src/
│       ├── app/                  # App Router pages & API routes
│       │   ├── layout.tsx        # Root layout (fonts, metadata)
│       │   ├── page.tsx          # / → redirect to /dashboard
│       │   ├── login/            # Google OAuth login
│       │   ├── signup/           # Redirect to /login
│       │   ├── profile-setup/    # First-time profile form
│       │   ├── auth/callback/    # OAuth callback handler
│       │   ├── (app)/            # Protected route group
│       │   │   ├── layout.tsx    # Auth check + NavBar
│       │   │   ├── dashboard/    # Stats, pipeline preview, quick links
│       │   │   ├── coaches/      # Browse/search coaches & programs
│       │   │   ├── pipeline/     # Kanban CRM board
│       │   │   ├── outreach/     # Email/DM campaign management
│       │   │   │   └── dm/[id]/  # DM queue for specific campaign
│       │   │   └── profile/      # Edit athlete profile
│       │   └── api/              # API routes (see Section 5)
│       ├── components/
│       │   ├── ui/               # 60+ shadcn/ui components
│       │   ├── campaigns/        # Campaign creation wizard, cards, overlays
│       │   ├── dashboard/        # Stat cards, welcome header, pipeline preview
│       │   ├── programs/         # Coach detail panel, program detail, pipeline dialog
│       │   ├── NavBar.tsx        # Main navigation bar
│       │   └── gmail-token-capture-wrapper.tsx
│       ├── hooks/
│       │   ├── use-toast.ts      # Toast notification hook
│       │   └── use-gmail-token-capture.ts
│       └── lib/
│           ├── utils.ts          # cn() class merging utility
│           ├── gmail.ts          # Gmail API: send, refresh, tracking, scheduling
│           ├── merge-tags.ts     # ((tag)) resolution for templates
│           ├── app-url.ts        # Dynamic URL for dev/preview/production
│           └── supabase/
│               ├── client.ts     # Browser Supabase client
│               ├── server.ts     # Server Supabase client
│               ├── admin.ts      # Service-role admin client
│               └── middleware.ts  # Auth middleware logic
├── scripts/                      # Data pipeline scripts
│   ├── package.json              # pg, playwright, dotenv
│   ├── scrape-rml.js             # Scrape coaches from RecruitingMasterList.com
│   ├── sync-coaches.js           # Sync scraped data → Supabase
│   ├── download-logos.js         # Download program logos
│   ├── download-logos-pass2.js   # Second-pass logo downloads
│   ├── download-logos-njcaa.js   # NJCAA/JUCO logo downloads
│   ├── download-logos-naia.js    # NAIA logo downloads
│   ├── download-logos-juco.js    # JUCO logo downloads
│   ├── check-d1-logos.js         # Verify D1 logo coverage
│   ├── fix-d1-logos.js           # Fix missing D1 logos
│   ├── check-d2d3-logos.js       # Verify D2/D3 logo coverage
│   ├── fix-d2d3-logos.js         # Fix missing D2/D3 logos
│   ├── fix-d2d3-final.js         # Final D2/D3 logo fixes
│   ├── check-naia-missing.js     # Check NAIA logo gaps
│   ├── check-all-logos.js        # Audit all logo coverage
│   ├── check-broken-logos.js     # Find broken logo references
│   ├── fix-external-logos.js     # Convert external URLs to self-hosted
│   ├── fix-espn-logos.js         # Fix ESPN logo URLs
│   ├── find-espn-ids.js          # Match programs to ESPN team IDs
│   ├── populate-espn-logos.js    # Populate logos from ESPN API
│   └── fix-troy.js               # One-off fix for Troy University
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql    # Core schema (tables, enums, RLS, triggers)
│       ├── 002_seed_system_templates.sql  # System email templates
│       ├── 003_rml_sync_columns.sql  # is_active, rml_source_key columns
│       └── 004_dm_campaigns.sql      # DM campaign type + columns
├── .github/
│   └── workflows/
│       └── update-coaches.yml    # Bi-weekly RML scrape + sync cron
└── data/                         # Scraped data (gitignored)
    └── rml_all_coaches.json      # Raw coach data from RML
```

---

## 3. Database Schema

### Supabase Project
- **Project ID:** `ufmzldfkdpjeyvjfpoid`
- **Region:** us-west-2
- **Auth:** Google OAuth only

### Enums
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

### Tables

#### `profiles` — Athlete user profiles (extends auth.users)
| Column | Type | Constraints |
|--------|------|------------|
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
| can_send_emails | BOOLEAN | DEFAULT FALSE (safety gate) |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |

#### `programs` — College football programs
| Column | Type | Constraints |
|--------|------|------------|
| id | UUID | PK DEFAULT gen_random_uuid() |
| school_name | TEXT | NOT NULL |
| division | division | NOT NULL |
| conference | TEXT | |
| state | TEXT | |
| city | TEXT | |
| website | TEXT | |
| logo_url | TEXT | Self-hosted path: /logos/{uuid}.png |
| espn_id | TEXT | ESPN team ID for API lookups |
| rml_school_name | TEXT | Original name from RML data |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |

#### `coaches` — College coaching staff
| Column | Type | Constraints |
|--------|------|------------|
| id | UUID | PK DEFAULT gen_random_uuid() |
| program_id | UUID | NOT NULL, FK → programs(id) ON DELETE CASCADE |
| first_name | TEXT | NOT NULL |
| last_name | TEXT | NOT NULL |
| title | TEXT | |
| email | TEXT | |
| phone | TEXT | |
| twitter_handle | TEXT | |
| twitter_dm_open | BOOLEAN | DEFAULT FALSE |
| is_active | BOOLEAN | NOT NULL DEFAULT TRUE (soft-delete flag) |
| rml_source_key | TEXT | Dedup key for sync |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |

**Constraints:** UNIQUE(program_id, first_name, last_name) — added outside migration
**Indexes:** idx_coaches_program, idx_coaches_rml_source_key, idx_coaches_is_active

#### `pipeline_stages` — Reference table for CRM stages
| display_order | name | description |
|--------------|------|-------------|
| 1 | Initial Contact | Exchange communication, fill out questionnaire |
| 2 | Evaluation | Coach watched film, passed to position coach |
| 3 | Interest | Coach engages, invites to campus, asks for more film |
| 4 | Campus Visit | Junior day, game day visit, official visit |
| 5 | Offer | Received an offer from the program |
| 6 | Decision/Commit | Athlete makes their decision |

#### `pipeline_entries` — Per-athlete, per-program pipeline position
| Column | Type | Constraints |
|--------|------|------------|
| id | UUID | PK |
| athlete_id | UUID | NOT NULL, FK → profiles(id) |
| program_id | UUID | NOT NULL, FK → programs(id) |
| stage_id | UUID | NOT NULL, FK → pipeline_stages(id) |
| primary_coach_id | UUID | FK → coaches(id) |
| status | pipeline_status | NOT NULL DEFAULT 'active' |
| notes | TEXT | |
| created_at / updated_at | TIMESTAMPTZ | |

**Constraint:** UNIQUE(athlete_id, program_id)

#### `interactions` — Activity log per pipeline entry
| Column | Type | Constraints |
|--------|------|------------|
| id | UUID | PK |
| pipeline_entry_id | UUID | NOT NULL, FK → pipeline_entries(id) |
| athlete_id | UUID | NOT NULL, FK → profiles(id) |
| coach_id | UUID | FK → coaches(id) |
| type | interaction_type | NOT NULL |
| direction | interaction_direction | NOT NULL |
| subject | TEXT | |
| body | TEXT | |
| occurred_at | TIMESTAMPTZ | DEFAULT NOW() |

#### `action_items` — To-do items for athletes
| Column | Type | Constraints |
|--------|------|------------|
| id | UUID | PK |
| athlete_id | UUID | NOT NULL, FK → profiles(id) |
| pipeline_entry_id | UUID | FK → pipeline_entries(id) |
| title | TEXT | NOT NULL |
| description | TEXT | |
| due_date | DATE | |
| priority | action_priority | DEFAULT 'medium' |
| status | action_status | DEFAULT 'pending' |
| auto_generated | BOOLEAN | DEFAULT FALSE |
| completed_at | TIMESTAMPTZ | |

#### `email_templates` — Reusable email templates
| Column | Type | Constraints |
|--------|------|------------|
| id | UUID | PK |
| name | TEXT | NOT NULL |
| stage_id | UUID | FK → pipeline_stages(id) |
| subject | TEXT | NOT NULL |
| body | TEXT | NOT NULL |
| created_by | UUID | FK → profiles(id) |
| is_system | BOOLEAN | DEFAULT FALSE |

System templates are seeded in migration 002 and cover goals: Get a Response (4 templates), Evaluate Film (1), Build Interest (2), Secure Visit (2), Other (1).

#### `campaigns` — Email/DM campaign definitions
| Column | Type | Constraints |
|--------|------|------------|
| id | UUID | PK |
| user_id | UUID | FK → profiles(id) |
| name | TEXT | NOT NULL |
| goal | TEXT | |
| type | TEXT | DEFAULT 'email' ('email' or 'dm') |
| status | TEXT | 'draft', 'active', 'paused', 'cancelled', 'completed' |
| dm_message_body | TEXT | Merge-tag template for DM campaigns |
| scheduled_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |

#### `campaign_emails` — Multi-step email sequence per campaign
| Column | Type | Constraints |
|--------|------|------------|
| id | UUID | PK |
| campaign_id | UUID | FK → campaigns(id) |
| step_number | INTEGER | |
| subject | TEXT | |
| body | TEXT | |
| send_after_days | INTEGER | Delay before sending this step |

#### `campaign_recipients` — Individual recipients in a campaign
| Column | Type | Constraints |
|--------|------|------------|
| id | UUID | PK |
| campaign_id | UUID | FK → campaigns(id) |
| coach_id | UUID | FK → coaches(id) |
| coach_name | TEXT | |
| coach_email | TEXT | Nullable (DM-only coaches) |
| program_name | TEXT | |
| twitter_handle | TEXT | For DM campaigns |
| status | TEXT | 'pending', 'scheduled', 'sent', 'replied', 'bounced', 'error', 'unsubscribed' |
| current_step | INTEGER | Which email step they're on |
| next_send_at | TIMESTAMPTZ | Calculated send time |
| dm_sent_at | TIMESTAMPTZ | When DM was marked sent |
| sent_at | TIMESTAMPTZ | |
| opened_at | TIMESTAMPTZ | |
| replied_at | TIMESTAMPTZ | |

#### `email_events` — Granular email tracking events
| Column | Type | Constraints |
|--------|------|------------|
| id | UUID | PK |
| campaign_id | UUID | |
| recipient_id | UUID | |
| event_type | TEXT | 'sent', 'opened', 'clicked', 'replied', 'bounced' |
| metadata | JSONB | user_agent, subject, snippet, etc. |
| created_at | TIMESTAMPTZ | |

#### `email_send_log` — Historical send records
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID | |
| recipient_id | UUID | |
| campaign_id | UUID | |
| gmail_message_id | TEXT | From Gmail API response |
| sent_at | TIMESTAMPTZ | |

#### `email_sends` — Legacy email tracking (from migration 001)
| Column | Type | Constraints |
|--------|------|------------|
| id | UUID | PK |
| athlete_id | UUID | FK → profiles(id) |
| template_id | UUID | FK → email_templates(id) |
| coach_id | UUID | FK → coaches(id) |
| to_email | TEXT | NOT NULL |
| subject | TEXT | NOT NULL |
| body | TEXT | NOT NULL |
| status | email_status | DEFAULT 'queued' |
| sent_at | TIMESTAMPTZ | |
| opened_at | TIMESTAMPTZ | |

#### `gmail_tokens` — Per-user Gmail OAuth tokens
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK → profiles(id), UNIQUE |
| email | TEXT | Gmail address |
| access_token | TEXT | |
| refresh_token | TEXT | |
| token_expiry | TIMESTAMPTZ | |
| account_tier | TEXT | 'new', 'building', 'established', 'veteran' |
| connected_at | TIMESTAMPTZ | |

#### `twitter_tokens` — Per-user Twitter/X OAuth tokens (migration 005)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK → profiles(id), UNIQUE |
| twitter_user_id | TEXT | Twitter numeric user ID |
| twitter_handle | TEXT | Twitter @handle |
| access_token | TEXT | |
| refresh_token | TEXT | |
| token_expiry | TIMESTAMPTZ | |
| connected_at | TIMESTAMPTZ | |

#### `system_settings` — Global config (key-value)
| Key | Purpose |
|-----|---------|
| email_sending_enabled | Kill switch for all email sending ("true"/"false") |

#### `email_allowlist` — Approved sender emails
| Column | Type | Notes |
|--------|------|-------|
| email | TEXT | Email address allowed to send |

#### `unsubscribes` — Coach email opt-outs
| Column | Type | Notes |
|--------|------|-------|
| email | TEXT | Unsubscribed email address |
| campaign_id | UUID | Which campaign triggered the unsub |

### Row Level Security (RLS)
All tables have RLS enabled:
- **profiles**: Users see/update own; admins see all; new users can insert own
- **programs/coaches**: All authenticated users can read; admins can manage
- **pipeline_stages**: All authenticated can read
- **pipeline_entries/interactions/action_items**: Athletes see own; admins see all
- **email_templates**: All authenticated can read; admins can manage
- **email_sends**: Athletes see own; admins see all

### Triggers
- `on_auth_user_created` → auto-creates profile row from auth.users metadata
- `update_*_updated_at` → auto-sets updated_at on UPDATE for profiles, programs, coaches, pipeline_entries, email_templates

---

## 4. Pages & Routes

### Public Routes
| Path | Purpose |
|------|---------|
| `/` | Redirects to `/dashboard` |
| `/login` | Google OAuth sign-in page |
| `/signup` | Redirects to `/login` |
| `/profile-setup` | First-time profile completion (name, position, school, etc.) |
| `/auth/callback` | Handles Google OAuth code exchange |

### Protected Routes (under `(app)` route group)
All require authentication via `(app)/layout.tsx` server-side check.

| Path | Purpose | Key Data |
|------|---------|----------|
| `/dashboard` | Home — stats overview, pipeline preview, quick links | Program/coach/pipeline counts, stage breakdown |
| `/coaches` | Browse & search coaches database with program cards | All programs, filterable by division/conference/search |
| `/pipeline` | Kanban board — drag programs between recruiting stages | Pipeline stages + entries with program data |
| `/outreach` | Campaign management — create, view, launch email/DM campaigns | Templates, programs, gmail status, campaign history |
| `/outreach/dm/[id]` | DM queue — manually send DMs to coaches in a campaign | Campaign recipients with twitter handles, athlete profile for merge tags |
| `/profile` | Edit athlete profile | Full profile record |

### Middleware Flow (`src/middleware.ts` → `src/lib/supabase/middleware.ts`)
1. Updates Supabase session cookies on every request
2. Skips `getUser()` on `/auth/callback` (preserves PKCE code_verifier)
3. If no user and not public route → redirect to `/login`
4. If user on `/login` or `/signup` → redirect to `/dashboard`
5. If user missing `first_name` or `position` → redirect to `/profile-setup`

---

## 5. API Routes

### Campaign Management

**POST `/api/campaigns/create`** — Create email or DM campaign
- Auth: Required
- Body: `{ name, goal, type?, templates[]?, recipients[], scheduledAt?, status?, dmMessageBody? }`
- Tables: campaigns, campaign_emails, campaign_recipients

**GET `/api/campaigns/[id]`** — Get campaign overview with stats
- Auth: Required (validates ownership)
- Returns: campaign, emails, recipients, stats (total/pending/scheduled/sent/replied/bounced/opened/clicked)

**PATCH `/api/campaigns/[id]`** — Update campaign status
- Body: `{ status: 'paused' | 'cancelled' | 'active' }`
- Pausing resets scheduled → pending; cancelling clears pending/scheduled

**POST `/api/campaigns/[id]/launch`** — Launch campaign with scheduling
- **Safety checks**: user `can_send_emails` + valid gmail_tokens + campaign is draft/paused
- Calculates send schedule based on Gmail tier rate limits
- Triggers queue processing if launch time is now

**GET `/api/campaigns/[id]/details`** — Full campaign analytics
- Returns: campaign, stats, emails, programsWithRecipients (grouped by program)

### DM Campaign Routes

**GET `/api/dm-campaigns/[id]/details`** — DM campaign with athlete profile
- Returns: campaign, recipients (with twitter_handle), profile (for merge tags), stats

**POST `/api/dm-campaigns/[id]/mark-sent`** — Mark DM as sent
- Body: `{ recipientId, sent: boolean }`
- Side effects: creates pipeline entry if none exists, logs interaction, auto-completes campaign when all sent

### Coach Search

**GET `/api/coaches/search`** — Search coaches with pagination
- Query: `q` (search), `division` (filter), `offset`, `limit`
- Filters: `is_active = true` only
- Returns: coaches with joined program data, total count

**GET `/api/programs/[id]/coaches`** — All active coaches for a program

### Email Processing (Cron)

**GET `/api/email/process-queue`** — Process scheduled email queue
- Auth: CRON_SECRET header
- **Three safety gates**: (1) kill switch, (2) user can_send_emails, (3) email allowlist
- Checks unsubscribe list, resolves merge tags, sends via Gmail API
- Adds tracking pixel + click tracking + unsubscribe footer
- Logs to email_send_log and email_events
- Rate limited by Gmail tier

**GET `/api/email/check-replies`** — Detect coach replies
- Auth: CRON_SECRET header
- Searches Gmail inbox for messages from each coach email (newer_than:2d)
- Updates recipient status to "replied", logs email_events

### Gmail OAuth & Token Management

**GET `/api/gmail/authorize`** — Initiate Google OAuth flow
- Scopes: gmail.send, gmail.readonly, userinfo.email
- State param includes userId + optional campaignId

**GET `/api/gmail/oauth-callback`** — Handle OAuth callback
- Exchanges code for tokens, determines account tier by account age
- Upserts to gmail_tokens, redirects to /outreach with params

**GET `/api/gmail/status`** — Check Gmail connection status
**GET `/api/gmail/refresh`** — Refresh token if expired
**GET `/api/gmail/force-refresh`** — Force immediate token refresh
**POST `/api/gmail/check-all-tokens`** — Admin: check/refresh all user tokens
**POST `/api/gmail/cron-refresh`** — Cron: batch refresh expiring tokens

### Twitter/X OAuth & DM Sending

**GET `/api/twitter/authorize`** — Initiate Twitter OAuth 2.0 PKCE flow
- Scopes: dm.read, dm.write, tweet.read, users.read, offline.access
- State param includes userId + optional campaignId
- Stores code_verifier in HttpOnly cookie

**GET `/api/twitter/oauth-callback`** — Handle Twitter OAuth callback
- Exchanges code+verifier for tokens, gets user profile
- Upserts to twitter_tokens, redirects to /outreach with params

**GET `/api/twitter/status`** — Check Twitter connection status
**POST `/api/twitter/refresh`** — Refresh expired token

**POST `/api/dm-campaigns/[id]/send-dm`** — Send DM via Twitter API
- Auth: Required (validates campaign ownership)
- Body: `{ recipientId }`
- Resolves merge tags, looks up Twitter user ID, sends DM
- Auto-creates pipeline entry + logs interaction
- Caches Twitter user ID in campaign_recipients.twitter_user_id

### Email Tracking

**GET `/api/track/open`** — Tracking pixel endpoint (returns 1x1 GIF)
- Query: `rid` (recipient_id), `cid` (campaign_id)

**GET `/api/track/click`** — Click tracking with redirect
- Query: `rid`, `cid`, `url` (target)
- Logs event then 302 redirects to target URL

### Templates

**GET `/api/templates`** — List system + user's custom templates
**POST `/api/templates`** — Create custom template
**PUT `/api/templates/[id]`** — Update template (own non-system only)
**DELETE `/api/templates/[id]`** — Delete template (own non-system only)

### Other

**GET `/api/unsubscribe`** — Coach email opt-out (returns HTML page)
**GET `/api/espn/team`** — Fetch ESPN team data (color, record, news, links)
**POST `/api/admin/enable-email`** — Toggle email kill switch
**GET `/api/debug/session`** — Debug current auth session

---

## 6. Key Components

### Navigation
- **NavBar.tsx** — Sticky header with red accent stripe, oversized logo, centered nav (Dashboard/Programs/Pipeline/Outreach/Profile), user avatar dropdown, mobile hamburger menu

### Dashboard (`components/dashboard/`)
- **welcome-header.tsx** — Time-based greeting (Good morning/afternoon/evening) + date
- **stat-cards.tsx** — 4-card grid: Programs, Coaches, Outreach Sent, In Pipeline
- **pipeline-preview.tsx** — Pipeline stage overview
- **action-items.tsx** — Quick action list
- **quick-links.tsx** — Navigation shortcuts
- **recruiting-ticker.tsx** — Scrolling ticker

### Campaigns (`components/campaigns/`)
- **campaign-card.tsx** — Status badge, email/DM stats, progress bar, launch button for drafts
- **quick-email-modal.tsx** — Goal selection (Get Response, Evaluate Film, Build Interest, Secure Visit, Other)
- **create-campaign-overlay.tsx** — Full-screen campaign creation wizard
- **steps/target-step.tsx** — Division pills, program search, conference expansion, coach selection with position-based recommendations
- **steps/build-step.tsx** — Email template builder
- **steps/dm-compose-step.tsx** — DM content editor
- **steps/channel-step.tsx** — Email vs DM channel selection
- **steps/goal-step.tsx** — Campaign goal selection
- **campaign-details-overlay.tsx** — Campaign analytics view
- **launch-confirmation-overlay.tsx** — Pre-launch confirmation
- **campaign-launched-overlay.tsx** — Post-launch success

### Programs (`components/programs/`)
- **coach-detail.tsx** — Slide-in panel with coach info, contact (copy-to-clipboard), DM badge, action buttons (Send DM/Email/Call)
- **program-detail.tsx** — Detailed program view
- **add-to-pipeline-dialog.tsx** — Add program to pipeline

### Auth
- **gmail-token-capture-wrapper.tsx** — Captures OAuth tokens after Gmail connect

---

## 7. Authentication Flow

1. User visits any protected route → middleware redirects to `/login`
2. User clicks "Sign in with Google" → `signInWithOAuth` with Google provider
3. Google redirects to `/auth/callback?code=...`
4. `auth/callback/route.ts` exchanges code for Supabase session
5. Middleware detects user, checks profile completion
6. If missing `first_name` or `position` → redirect to `/profile-setup`
7. Otherwise → redirect to `/dashboard`
8. On subsequent requests, `(app)/layout.tsx` performs server-side auth check

### Profile Setup
- Collects: first_name, last_name, position, grad_year, high_school, city, state
- Optional: gpa, height, weight, phone, hudl_url, twitter_handle
- Prefills name from Google metadata
- Upserts to `profiles` table

---

## 8. Email System

### Gmail Integration
- OAuth2 with scopes: `gmail.send`, `gmail.readonly`, `userinfo.email`
- Tokens stored in `gmail_tokens` table with expiry tracking
- Auto-refresh when expired; cron job for batch refresh

### Account Tiers & Rate Limiting
| Tier | Age | Daily Limit | Hourly Limit |
|------|-----|-------------|--------------|
| new | 0-14 days | 20 | 5 |
| building | 14-30 days | 50 | 10 |
| established | 30-90 days | 100 | 20 |
| veteran | 90+ days | 200 | 30 |

Tier is determined by connection age + total sends.

### Queue Processor (`/api/email/process-queue`)
1. Check kill switch (`system_settings.email_sending_enabled`)
2. Check user permission (`profiles.can_send_emails`)
3. Check email allowlist (`email_allowlist` table)
4. Fetch scheduled recipients (status='scheduled', next_send_at <= now, max 50)
5. Check unsubscribe list
6. Resolve merge tags in template
7. Send via Gmail API (MIME multipart: plain text + HTML)
8. Add tracking pixel + link tracking + unsubscribe footer
9. Log to `email_send_log` + `email_events`
10. Schedule next step or mark complete

### Reply Detection (`/api/email/check-replies`)
- Searches Gmail for messages from each coach email (newer_than:2d)
- Extracts first reply snippet and subject
- Updates recipient status to "replied"
- 200ms delay per coach to avoid Gmail API rate limits

### Merge Tags
Two formats supported: `((Tag Name))` (primary) and `{{tag_name}}` (backwards compat).

| Tag | Source |
|-----|--------|
| Coach_Name, Coach_Last_Name | Coach record |
| School, School_Name | Program record |
| First_Name, Last_Name | Athlete profile |
| Position, Grad_Year | Athlete profile |
| High_School, City, State, City_State | Athlete profile |
| Phone, Email, All_Contact_Info | Athlete profile |
| Film_Link, Hudl_URL | Athlete profile |
| GPA, Stats | Athlete profile |
| Recent_Achievement, Improvement_Area | Athlete-provided |

### Email Tracking
- **Open tracking**: 1x1 transparent GIF pixel via `/api/track/open`
- **Click tracking**: Links wrapped through `/api/track/click` (302 redirect)
- **Unsubscribe**: Footer link to `/api/unsubscribe` (renders HTML page, updates DB)

---

## 9. DM Campaign System

DM campaigns support two modes: **manual assist** (copy + paste) and **auto-send** via the Twitter/X API.

### Manual Flow
1. Athlete creates DM campaign (type="dm") with coach recipients who have `twitter_dm_open = true`
2. Writes a DM template with merge tags
3. In DM Queue (step 4 of campaign overlay, or standalone `/outreach/dm/[id]`)
4. For each coach: sees resolved message, copies it, opens X, pastes, clicks "Mark as Sent"

### Auto-Send Flow (requires Twitter/X API connection)
1. Athlete connects X account via OAuth 2.0 PKCE (`/api/twitter/authorize`)
2. Tokens stored in `twitter_tokens` table
3. In DM Queue: "Send DM" button appears per coach, "Send All" button for batch
4. `/api/dm-campaigns/[id]/send-dm` resolves merge tags, looks up Twitter user ID, sends via API
5. Recipient Twitter user IDs cached in `campaign_recipients.twitter_user_id`

### Shared Behavior (both modes)
- Updates `campaign_recipients.dm_sent_at` and status
- Auto-creates `pipeline_entry` if none exists (stage = "Initial Contact")
- Logs `interaction` (type: "dm_sent", direction: "outbound")
- Campaign auto-completes when all recipients are marked/confirmed sent

### Twitter/X OAuth
- OAuth 2.0 with PKCE (code_verifier stored in HttpOnly cookie)
- Scopes: `dm.read dm.write tweet.read users.read offline.access`
- Tokens stored in `twitter_tokens` table (UNIQUE per user_id)
- Token refresh via `/api/twitter/refresh`
- Status check via `/api/twitter/status`
- Env vars: `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET`

### Twitter API Rate Limits (Basic tier, $100/month)
- DM sends: ~200/day
- User lookups: 100/request, 300 requests/15 min
- 1.5s delay between auto-sends to stay safe

---

## 10. Pipeline & CRM

### Kanban Board (`/pipeline`)
- 6 default stages displayed as columns (see pipeline_stages table above)
- Each card shows program logo, school name, division, primary coach
- Drag-and-drop between stages updates `pipeline_entries.stage_id`
- Card click opens program detail

### Pipeline Entry
- UNIQUE per (athlete_id, program_id) — one entry per program per athlete
- Status: active (in play), dead (no longer pursuing), committed
- Optional primary_coach_id and notes

### Interactions Log
- Every pipeline entry can have multiple interactions
- Types: email_sent, email_received, dm_sent, dm_received, call, visit, film_sent, questionnaire, camp_invite, offer, other
- Direction: inbound or outbound
- DM sends auto-log via mark-sent API

---

## 11. ESPN Integration

### `/api/espn/team` Endpoint
- Input: ESPN team ID (stored in `programs.espn_id`)
- Fetches in parallel: team info, news, standings
- Returns: team colors, record (overall/home/away/conference/streak), news articles, useful links (Clubhouse, Roster, Statistics, Schedule)
- Standings: tries current season, falls back to 2024

### ESPN ID Mapping
- `find-espn-ids.js` script matches programs to ESPN team IDs
- `programs.espn_id` column stores the mapping

---

## 12. Coach Data Sync

### Data Source: RecruitingMasterList.com (RML)
- Paid membership site with ~11,800 college football coaches
- WordPress/WooCommerce with reCAPTCHA on login
- Data in a Google Sheet rendered via Sheet2Site iframe
- 12 columns: School, Name, Position, Twitter, Phone, Email, Division, DMs Open?, Conference, State, Recruiter?, Recruiting Questionnaire

### Scrape Pipeline (`scripts/scrape-rml.js`)
1. `--login` flag: opens headed browser, pre-fills credentials, user solves CAPTCHA, saves cookies to `data/.rml-session.json`
2. Normal run: loads cookies, navigates to football page, enters iframe
3. Clicks "Load More" (~120 times) to load all coaches
4. Extracts all `<tr>` rows from DataTable
5. Saves to `data/rml_all_coaches.json`

### Sync Pipeline (`scripts/sync-coaches.js`)
- **Division mapping**: "NCAA D1 FBS"→FBS, "NCAA D1 FCS"→FCS, "D2"→DII, "D3"→DIII, "JC*"→JUCO, "NAIA"→NAIA
- **School matching**: 5-level cascade (rml_school_name → manual override → exact → normalized → short name)
- **Coach matching**: source key → program+email → program+name → email-only (school transfer)
- **Dedup**: ~130 "second email" duplicates handled by ON CONFLICT (program_id, first_name, last_name) DO UPDATE
- Uses `is_active = false` for soft-delete (FK refs prevent hard delete)

### GitHub Actions Cron (`.github/workflows/update-coaches.yml`)
- Schedule: bi-weekly (1st & 15th of month, 6 AM UTC)
- Manual trigger via workflow_dispatch
- Steps: checkout → Node 20 → install deps → install Playwright → scrape → sync → upload artifact
- Timeout: 180 minutes
- Secrets: RML_USERNAME, RML_PASSWORD, DATABASE_URL

---

## 13. Design System

### Fonts
- **Inter** (Google Font) — body text, `font-sans`, variable `--font-inter`
- **Oswald** (Google Font) — headings/display, `font-display`, variable `--font-oswald`, uppercase branding

### Color Palette (HSL via CSS variables)
| Token | HSL | Hex | Usage |
|-------|-----|-----|-------|
| Primary | 224 76% 30% | #1a3a6e | Buttons, nav, active states |
| Accent | 0 72% 51% | ~#d93025 | Top stripe, highlights, alerts |
| Background | 220 20% 97% | Off-white | Page background |
| Foreground | 222 47% 11% | Dark blue-gray | Body text |
| Card | 0 0% 100% | White | Card backgrounds |
| Muted | 220 14% 96% | Light gray | Secondary elements |
| Border | 220 13% 91% | Light gray | Borders, inputs |
| Sidebar BG | 224 76% 20% | Darker blue | Sidebar background |
| Sidebar Text | 0 0% 100% | White | Sidebar text |

### Component Library
- **60+ shadcn/ui components** in `src/components/ui/` (Button, Card, Dialog, Select, Table, Tabs, Toast, Tooltip, etc.)
- Variant management via `class-variance-authority` (CVA)
- Class merging via `cn()` — combines `clsx` + `tailwind-merge`

### UI Patterns
- **Responsive grid**: `grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4`
- **Container**: `max-w-7xl` with `px-4 lg:px-8` padding
- **Mobile-first**: base → sm (640) → md (768) → lg (1024) → xl (1280)
- **Icons**: Lucide React throughout
- **Toasts**: Sonner library (1 toast at a time)
- **Loading**: Skeleton components
- **Animations**: slide-in, fade-in, duration-200

---

## 14. Environment Variables

### Required (App)
| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public Supabase key (browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (API routes) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `CRON_SECRET` | Auth for cron endpoints |
| `TWITTER_CLIENT_ID` | Twitter/X API OAuth client ID |
| `TWITTER_CLIENT_SECRET` | Twitter/X API OAuth client secret |

### Required (Scripts)
| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Direct Postgres connection string |
| `RML_USERNAME` | RML site login |
| `RML_PASSWORD` | RML site password |

### Vercel-Provided
| Variable | Purpose |
|----------|---------|
| `VERCEL_URL` | Auto-generated preview URL |
| `VERCEL` | "1" when running on Vercel |

---

## 15. Deployment

### Vercel Configuration
- **Team**: `team_Nqk0zqkPJHAc5cBb6YqZZDF6`
- **Project**: `prj_xALRb9vJSGYSFQiVT5NQoaeaJrZ9`
- **Production domain**: gridironeliterecruiting.com
- **Framework**: Auto-detected Next.js
- **Root directory**: `app/` (since no root package.json)
- **`app/vercel.json`**: Configures Vercel cron job for email queue processing

### Vercel Cron Jobs
```json
{
  "crons": [
    { "path": "/api/email/process-queue", "schedule": "0 9 * * *" }
  ]
}
```
Email queue processes daily at 9:00 AM UTC via Vercel Cron.

### Branch Strategy
| Branch | Environment | URL |
|--------|-------------|-----|
| `main` | Production | gridironeliterecruiting.com |
| `staging` | Preview | *.vercel.app preview URL |

### Deployment Workflow
1. Always push to `staging` first: `git push origin staging`
2. Test on Vercel preview URL
3. Push to production: `git push origin main`
4. Keep branches in sync: `git push origin main:staging`

### Dynamic URL Resolution (`lib/app-url.ts`)
Priority: browser origin → request host → VERCEL_URL → localhost:3001 → gridironeliterecruiting.com

---

## 16. Logo System

### Self-Hosted Logos
- ~690 PNG logos stored in `app/public/logos/` as `{program_uuid}.png`
- Database `programs.logo_url` stores relative path: `/logos/{uuid}.png`
- Served by Next.js static file serving

### Coverage by Division
| Division | Coverage | Notes |
|----------|----------|-------|
| FBS | ~100% | All logos present |
| FCS | ~100% | All logos present |
| DII | ~92% | Some gaps |
| DIII | ~92% | Some gaps |
| NAIA | ~97% | 97/100 via VSN |
| JUCO | Partial | Blocked by Cloudflare on download |

### Fallback System
- All program displays use `onError` handler on `<img>` tags
- On error: hides broken image, shows 2-character initials badge instead
- Initials derived from school_name (first two letters of first word)
- Graceful degradation — no broken image icons anywhere

### Logo Scripts
Multiple scripts for downloading and fixing logos across divisions — see `scripts/` directory. Sources include ESPN API, VSN (VisualSportsNetwork), and manual downloads.

---

## 17. Key Safety Gates

### Three-Layer Email Safety
1. **Kill Switch** — `system_settings.email_sending_enabled` must be "true" (toggled via `/api/admin/enable-email`)
2. **Per-User Permission** — `profiles.can_send_emails` must be true (manually set in DB)
3. **Email Allowlist** — sender's email must exist in `email_allowlist` table

All three must pass before any email is sent. This prevents accidental mass-emailing.

### Other Safety Measures
- **Campaign ownership validation**: All campaign operations check `user_id` match
- **Rate limiting**: Tier-based daily/hourly limits enforced by Gmail tier system
- **Unsubscribe**: Every email includes unsubscribe footer; checked before each send
- **Soft-delete for coaches**: `is_active` flag instead of hard delete (FK refs)
- **PKCE flow**: Auth callback skips getUser() to preserve code_verifier cookie

---

## 18. Known Gaps & Improvement Areas

### Data Gaps
- **JUCO logos**: Many JUCO program logos couldn't be downloaded (Cloudflare blocking)
- **DII/DIII logos**: ~8% missing for each division
- **Coach data freshness**: Depends on bi-weekly RML sync; coaching changes between syncs are stale

### Feature Gaps
- **No real-time updates**: Dashboard stats are snapshot-on-load, no WebSocket/polling
- **No bulk email preview**: Can't preview all resolved merge tags before launch
- **No A/B testing**: Single template per email step
- **No analytics dashboard**: Email stats are per-campaign only, no cross-campaign analytics
- **DM automation**: Manual-only (no Twitter API integration)
- **No team/multi-user support**: Single-athlete per account

### Technical Debt
- Legacy `email_sends` table from migration 001 (now using campaigns + email_events)
- Reply checking (`/api/email/check-replies`) has no cron trigger configured
- `next.config.ts` is empty (no custom config)
- Some tables (campaigns, campaign_emails, campaign_recipients, email_events, email_send_log, gmail_tokens, system_settings, email_allowlist, unsubscribes) were created outside migration files

---

## 19. Query Patterns & Conventions

### Coach Queries
All coach queries filter `.eq("is_active", true)` in:
- `/api/coaches/search`
- `/api/programs/[id]/coaches`
- Dashboard coach count

### Supabase Client Usage
- **Browser**: `createClient()` from `lib/supabase/client.ts` (anon key)
- **Server Components**: `createClient()` from `lib/supabase/server.ts` (cookie-based)
- **API Routes (admin ops)**: `createClient()` from `lib/supabase/admin.ts` (service role)

### Script Patterns
- Scripts use `pg` Pool with direct SQL (not Supabase client)
- Connection via `DATABASE_URL` env var
- Pattern: connect → query → process → disconnect

---

## 20. Git Configuration

- **User**: Paul Kongshaug <gridironeliterecruiting@gmail.com>
- **Main branch**: `main` (production)
- **Staging branch**: `staging` (preview)
- **GitHub repo**: gridironeliterecruiting-maker/gridiron-elite-recruiting
