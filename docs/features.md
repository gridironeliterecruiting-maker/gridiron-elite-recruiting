# Features Reference

---

## Email System (Gmail — Legacy / Existing Users)

Gmail OAuth2 scopes: `gmail.send`, `gmail.readonly`, `userinfo.email`
Tokens in `gmail_tokens` table. Auto-refresh on expiry; cron batch refresh via `/api/gmail/cron-refresh`.

### Gmail Account Tiers
| Tier | Age | Daily | Hourly |
|------|-----|-------|--------|
| new | 0–14d | 20 | 5 |
| building | 14–30d | 50 | 10 |
| established | 30–90d | 100 | 20 |
| veteran | 90d+ | 200 | 30 |

### Merge Tags
Two formats: `((Tag Name))` (primary) and `{{tag_name}}` (backwards compat).

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
- Open: 1x1 GIF pixel via `/api/track/open`
- Click: links wrapped through `/api/track/click` (302 redirect)
- Unsubscribe: footer link → `/api/unsubscribe` (HTML page, updates DB)

---

## Email System (Zoho Mail360 — New System)

Provider: Zoho Mail360. Domain: jetstreammail.com.
Each athlete gets `name@jetstreammail.com` provisioned at profile-setup time.
Key file: `app/src/lib/workspace.ts`

Flow: `getZohoAccessToken()` → app-level OAuth → per-mailbox via `profiles.zoho_account_key`
Provisioning: `POST /api/accounts` with `accountType: '1'`
DNS verified: SPF, DKIM, DMARC, MX in GoDaddy → Zoho

---

## In-App Email Tab ✅ Built (`app/src/app/(app)/email/`)

Route: `/email`. Nav item between Campaigns and Profile. Nav rename: Outreach → Campaigns.

### Three Sections
**Inbox** — Inbound coach replies. Newest first. Full thread on click. Unread count badge on nav. Mark read/unread.

**Sent** — Rolled up by campaign. Row: campaign name, date, recipient count, stats. Expand for individual emails. Infinite scroll.

**Compose** — Clicking Compose redirects to /campaigns. Reply to specific coach stays in-app (sends via Zoho Mail360 API).

### Filing System
After reading → FILE button → auto-slots: Division → Conference → School → Coach
(e.g. FBS > Big Ten > Iowa > Kirk Ferentz)
program_id and coach_id on every campaign_recipient → we always know how to file.
Filed emails leave Inbox. Folders navigable from left sidebar.
Phase 2: search across all folders.

### Style
Left sidebar: Inbox / Sent / Folders / Compose. Email list center. Reading pane right. Mobile: list → tap → full screen.

### Push Notifications (Future)
PWA service workers. Phone push when coach replies.

---

## DM Campaign System

Two modes: **manual** (copy + paste) and **auto-send** (Twitter/X API).

### Manual Flow
1. Create DM campaign (type="dm") with coaches who have `twitter_dm_open = true`
2. Write DM template with merge tags
3. DM Queue: `/outreach/dm/[id]` or step 4 of campaign overlay
4. Per coach: see resolved message, copy, open X, paste, click "Mark as Sent"

### Auto-Send Flow
1. Connect X account via OAuth 2.0 PKCE (`/api/twitter/authorize`)
2. "Send DM" / "Send All" buttons appear in DM Queue
3. `/api/dm-campaigns/[id]/send-dm` resolves tags, looks up Twitter user ID, sends
4. Twitter user IDs cached in `campaign_recipients.twitter_user_id`

### Shared Behavior
- Creates `pipeline_entry` if none exists (stage = Initial Contact)
- Logs `interaction` (type: dm_sent, direction: outbound)
- Campaign auto-completes when all recipients done

### Twitter API (Basic tier, $100/month)
DM sends: ~200/day. User lookups: 100/request, 300 req/15min. 1.5s delay between auto-sends.
OAuth: confidential client (`:ci` suffix). Client secret had 0 vs O typo — fixed 2026-02-25.

---

## Pipeline / CRM

Kanban board at `/pipeline`. 6 stages as columns.
Cards: program logo, school name, division, primary coach.
Drag-and-drop updates `pipeline_entries.stage_id`.
UNIQUE(athlete_id, program_id) — one entry per program.

---

## ESPN Integration

`/api/espn/team` — Input: `programs.espn_id`
Returns: team colors, record (overall/home/away/conference/streak), news, links (Clubhouse/Roster/Statistics/Schedule).
Standings: tries current season, falls back to 2024.

---

## Coach Data Sync (RML)

Source: RecruitingMasterList.com (~11,800 coaches). WordPress/WooCommerce + reCAPTCHA.

**Scrape** (`scripts/scrape-rml.js`): `--login` flag for CAPTCHA session. Clicks "Load More" ~120x. Saves to `data/rml_all_coaches.json`.

**Sync** (`scripts/sync-coaches.js`):
- Division mapping: "NCAA D1 FBS"→FBS, "NCAA D1 FCS"→FCS, "D2"→DII, "D3"→DIII, "JC*"→JUCO, "NAIA"→NAIA
- School matching: 5-level cascade (rml_school_name → manual override → exact → normalized → short name)
- Coach matching: source key → program+email → program+name → email-only
- Dedup via ON CONFLICT (program_id, first_name, last_name) DO UPDATE
- Soft-delete: `is_active = false`

**GitHub Actions Cron**: bi-weekly (1st & 15th, 6 AM UTC). Timeout: 180 min.

---

## Logo System

~690 PNG logos in `app/public/logos/` as `{program_uuid}.png`.
`programs.logo_url` stores `/logos/{uuid}.png`.

| Division | Coverage |
|----------|----------|
| FBS | ~100% |
| FCS | ~100% |
| DII | ~92% |
| DIII | ~92% |
| NAIA | ~97% |
| JUCO | Partial (Cloudflare blocks downloads) |

Fallback: `onError` → hide image, show 2-char initials badge.

---

## Landing Page

`/` — Full marketing page. Redirects to `/hub` if `site_session=main`.
`/login` — Returning user. `/register` — New user.
Pricing: $50/month or $450/year (25% off).

Sections (top → bottom): Hero (dark) → Three Things (white, stadium) → Complete System (dark) → Pitch Quote (white, football) → Pricing (dark) → Ready to Take Off (white, jet) → Footer

White section overlay: `rgba(255,255,255,0.60)` + radial gradient `rgba(255,255,255,0.38)`.
Login background: locker-room-bg.png with same overlay (main login only — slug pages use plain bg-gray-50).

---

## Prep Site (runwayeliteprep.com)

Location: `/prep/` in same repo. Separate Supabase project (COPPA-safe). Separate Vercel project.
Dev port: 3002. Domains: runwayeliteprep.com / staging.runwayeliteprep.com.
Auth: Google OAuth only. Roles: parent (primary), athlete (Phase 4).
Billing: Stripe — Free / Starter ($19.99) / Pro ($29.99) / Elite ($49.99). Plans in `/prep/src/lib/stripe.ts`.

Schema (`/prep/supabase/schema.sql`): profiles, athletes, subscriptions, connections, connection_interactions, measurables, social_goals, tasks, athlete_tasks, task_completions.

Phase 1 complete: auth, profile-setup, dashboard, Exposure pipeline, Stripe checkout/webhook/portal, Settings.
Phase 2: connection pipeline (built in Phase 1).
Phase 3: Training & Academics (placeholder).
Phase 4: Athlete dual-login.

OAuth callback URLs needed in Google Cloud Console:
- `https://runwayeliteprep.com/auth/callback`
- `https://staging.runwayeliteprep.com/auth/callback`

---

## Film Hosting + Tracking (Roadmap — High Priority)

URL: `runwayrecruit.com/film/{username}`
Coach clicks link in email → branded page → instant play (no pre-roll, no login required).
Tracking: play, pause, % watched, rewatch, time spent → DB → real-time notification to athlete.
Video: athlete uploads Hudl MP4 to Supabase Storage or CDN.
Differentiator: Hudl requires coach account for analytics. Our page = zero friction, full data.
No competing platform does this today.

---

## Known Gaps / Technical Debt

- Legacy `email_sends` table (migration 001) — superseded by campaigns + email_events
- `/api/email/check-replies` has no cron trigger configured
- `next.config.ts` minimal (no custom config)
- Several tables created outside migration files (campaigns, email_events, gmail_tokens, etc.)
- JUCO logos: ~partial (Cloudflare blocks)
- DII/DIII logos: ~8% missing
- Dashboard stats: snapshot-on-load, no real-time updates
- No bulk email preview before launch
- No A/B testing
- No cross-campaign analytics dashboard
