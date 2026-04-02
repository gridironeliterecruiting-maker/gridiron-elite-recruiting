# Runway Recruit — Rules & Live State

> Codebase reference (schema, API routes, components, etc.) is in `docs/` — read those files only when needed.

---

## User Preferences
- Do NOT make arbitrary decisions. Ask on limits, thresholds, and behavior.
- Do NOT overengineer. Keep solutions simple.
- Be direct. Do the work yourself — don't deflect to the user.
- User always tests in a fresh incognito browser. Never suggest clearing cookies or cache — it's never the issue.
- Vercel CLI: always run from `app/` directory (linked to the `app` project).
- Vercel CLI for **prep**: deploy from repo root with `.vercel/project.json` swapped to `prj_cQLopEt9te38YmhKw6AC8ewGuOJI`, then restore. See prep deployment mechanics below.

## Tech Stack
Next.js 16 App Router · TypeScript · Tailwind CSS · shadcn/ui · Supabase (PostgreSQL + Auth + RLS) · Vercel
Supabase project: `ufmzldfkdpjeyvjfpoid` (us-west-2)
Full stack/directory/component reference: `docs/codebase.md`

---

## Deployment — READ BEFORE EVERY GIT PUSH

- **Staging**: https://staging.runwayrecruit.com
- **Production**: https://runwayrecruit.com
- Vercel team: `team_Nqk0zqkPJHAc5cBb6YqZZDF6` | project: `prj_xALRb9vJSGYSFQiVT5NQoaeaJrZ9`
- Two Vercel projects exist: `gridiron-elite-recruiting` (WRONG) and `app` (CORRECT, serves runwayrecruit.com)
- Vercel CLI linked from `app/` directory

### Branch Strategy — NON-NEGOTIABLE
- `staging` branch → staging site. ALL new work goes here. `git checkout staging` before any changes.
- `main` branch → prod only. NEVER commit to main directly.
- ⚠️ **PROD PUSH RULE**: NEVER run `git push origin main` unless user says "push to prod" or "push to production" in that exact message. "push" alone = staging only. If unsure, ASK.
- To push prod: `git checkout main && git merge staging && git push origin main`
- Staging and prod are **intentionally diverged**. Do not sync without explicit user approval.
- If a staging push fails → stop and fix it. NEVER fall back to pushing main.

---

## Runway Prep — Deployment

- **Staging**: https://staging.runwayprep.com
- **Production**: https://runwayprep.com
- Vercel project: `runway-elite-prep` (`prj_cQLopEt9te38YmhKw6AC8ewGuOJI`)
- Supabase project: `runway-elite-prep` (`ugkqwmlvntwkjkgdjrxf`)
- Code lives at `prep/` in this repo, deploys from `staging` branch

### Prep Branch Strategy — NON-NEGOTIABLE
- `staging` branch → staging.runwayprep.com. ALL prep work goes here.
- ⚠️ **PROD PUSH RULE**: NEVER deploy prep to production unless user says "push to prod" or "push to production".
- To deploy prep staging: swap root `.vercel/project.json` to prep project ID, run `npx vercel deploy --yes`, restore.
- To deploy prep prod: same swap, run `npx vercel deploy --prod --yes`, restore.

---

## Iron Wall Architecture — SITE ISOLATION

- `/admin`, `/prairie-ia`, `/cityhigh-ia` are **COMPLETELY SEPARATE SITES**. Supabase auth is shared, but each site has its own login state.
- **URLs are sacrosanct.** Logged into /admin → stay on /admin. NEVER redirect to a different site prefix.
- If a user's URL doesn't match their `site_session` → redirect to that URL's login page, even with a valid Supabase session.
- **NEVER cross high school programs.** /cityhigh-ia must never see Prairie Hawks data or branding.
- **NEVER downgrade admin role.** Skip `profiles.role` overwrite if current role is 'admin'.
- `gridironeliterecruiting@gmail.com` = sole admin (role='admin')
- `paulkongshaug@gmail.com` = role='athlete', coach on prairie-ia via program_members
- Coach detection uses `program_members.role`, NOT `profiles.role`

### `site_session` Cookie
| Site | Value |
|------|-------|
| /admin | `admin` |
| /prairie-ia | `prairie-ia` |
| /cityhigh-ia | `cityhigh-ia` |
| Main site | `main` |

Cookie: `site_session=<value>;path=/;max-age=31536000;samesite=lax` (1 year)

---

## Rebrand Status

- **Brand**: Runway Recruit | **Prod**: runwayrecruit.com (LIVE) | **Staging**: staging.runwayrecruit.com
- runwayeliterecruiting.com and gridironeliterecruiting.com → 301 to runwayrecruit.com
- New logo: `app/public/logo.png`
- **Pending in code**: NavBar, footer, ticker, unsubscribe page, email bodies still say "Runway Elite Recruiting"

---

## Email Infrastructure — Zoho Mail360

- **Provider**: Zoho Mail360 (switched 2026-03-10 — Google auto-suspended programmatic accounts)
- **Domain**: jetstreammail.com (athletes get `name@jetstreammail.com`)
- **Auth**: App-level OAuth (client_id + client_secret + refresh_token). Per-mailbox via `profiles.zoho_account_key`.
- **Key file**: `app/src/lib/workspace.ts` — exports `getZohoAccessToken`, `provisionZohoAccount`, `sendZohoEmail`, `deleteZohoAccount`
- **Staging env vars**: `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`, `ZOHO_DOMAIN=jetstreammail.com`
- flightschoolmail.com stays on Google Workspace (untouched)
- DNS for jetstreammail.com: SPF, DKIM, DMARC, MX all verified in GoDaddy → Zoho

### Email Safety Gates (ALL three must pass before any send)
1. Kill switch: `system_settings.email_sending_enabled = 'true'` (toggle via `/api/admin/enable-email`)
2. Per-user: `profiles.can_send_emails = true` (manually set in DB)
3. Allowlist: sender email in `email_allowlist` table

---

## Stripe (Live on Prod ✅)

- Flow: Register → `/checkout` → Stripe payment → `/profile-setup`
- Pricing: $50/month (`STRIPE_PRICE_MONTHLY`), $450/year (`STRIPE_PRICE_ANNUAL`)
- Grandfathered users: `profiles.is_grandfathered = true` (bypass checkout → go to dashboard)
- Users: Cael (caelkong3@gmail.com), Bubba (bubbadonald@icloud.com) are grandfathered
- Webhook handles: `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- API gotcha: `invoice.payment_intent` expand does NOT work in API 2026-02-25.clover — find PI by listing for customer and matching `status === 'requires_payment_method'`

---

## Pre-Prod Checklist

**Zoho Mail360**
- [x] Domain verified, DNS in GoDaddy, env vars on staging, API confirmed working
- [ ] E2E test: provisioning creates jetstreammail account via complete-profile flow

**Stripe Live**
- [x] Live on prod — checkout, webhook, subscriptions all working

**Database**
- [ ] Migration 012 to production (usernames, workspace_email, subscriptions, is_grandfathered)

**Features**
- [x] In-app email tab built (`app/src/app/(app)/email/`)
- [ ] Grandfathered users bypass checkout, land on dashboard

**Full E2E Staging Test**
- [ ] Register → Checkout → payment → profile-setup → workspace account created → dashboard
- [ ] Grandfathered bypass works
- [ ] Forgot password flow works
- [ ] Email sending works via Zoho Mail360
- [ ] In-app email tab shows sent emails

---

## Key Database Records

- Supabase MCP tools: `mcp__claude_ai_Supabase__execute_sql` / `apply_migration` (project_id: `ufmzldfkdpjeyvjfpoid`)
- Tables created 2026-02-27: `managed_programs`, `program_members`, `access_requests`
- Prairie Hawks: slug=`prairie-ia`, id=`239fee15-9727-448d-b339-721cfa457dc4`
- Paul's user ID: `1ec1646f-723a-4a9b-a36a-c870ad54860c` (role=admin, DO NOT change)
- Cael's user ID: `b63aa054-a9a7-46ff-be93-b7d4c7904922`
- Bubba's user ID: `467cf76e-111a-48bd-a734-2b9b0e7a2301`

---

## Roadmap

- Film hosting + tracking: `runwayrecruit.com/film/{username}` — high priority, no competitor does this
- Brand name rebrand in code: pending commit (NavBar, footer, ticker, etc.)
- Simplify program colors to 2 (primary + secondary, no white)
- Scope players to current program via `program_members`
- Coach Phase 2: in-app player invitation flow
- **Scale optimizations** (not urgent — current stack handles launch fine):
  - `process-queue`: consolidate duplicate sender profile fetch (lines 101 vs 174), cache email templates per (campaign_id, step) instead of re-fetching per recipient, batch allowlist + unsubscribe checks into two queries before the loop
  - `process-queue`: add retry logic for transient Zoho send failures (currently marks as permanent `error` with no recovery)
  - `campaigns/[id]` + `campaigns/[id]/details`: add pagination for recipients and events (prevents timeouts on 500+ recipient campaigns)
  - `email/thread/[threadId]`: cap messageIds array + add concurrency limit on parallel Zoho fetches
  - Middleware: consider caching profile/subscription lookup in a short-lived cookie to avoid 2-3 DB calls per page load

---

## Git Config

- User: Paul Kongshaug &lt;gridironeliterecruiting@gmail.com&gt;
- Repo: gridironeliterecruiting-maker/gridiron-elite-recruiting
- URL-based routing: implemented (commit f550694). Middleware rewrites `/{slug}/{route}` → `/{route}` with `x-program-slug` header.
- Twitter OAuth: confidential client (`:ci` suffix). Client secret had 0 vs O typo — fixed 2026-02-25.

---

## Reference Docs (`docs/`)

| File | Contents |
|------|----------|
| `database.md` | Full schema, enums, RLS, triggers, query patterns |
| `api.md` | All API routes |
| `codebase.md` | Tech stack, directory structure, components, design system, env vars |
| `features.md` | Email system, DM campaigns, pipeline CRM, ESPN, coach sync, logos, email tab spec, prep site |
