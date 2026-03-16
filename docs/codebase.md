# Codebase Reference

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 App Router |
| Language | TypeScript |
| UI | React 19, Tailwind CSS 3.4, shadcn/ui (60+ Radix components) |
| Backend | Supabase (PostgreSQL, Auth, RLS) |
| Auth | Supabase Auth (Google OAuth + email/password) |
| Hosting | Vercel |
| Icons | Lucide React |
| Charts | Recharts |
| Forms | React Hook Form + Zod |
| Scraping | Playwright |
| CI/CD | GitHub Actions (bi-weekly coach sync) |

Architecture: Server Components for data fetching, Client Components for interactivity. No root `package.json` — app code in `/app/`, scripts in `/scripts/`.

---

## Directory Structure

```
gridiron-elite-recruiting/
├── app/                          # Next.js application
│   ├── public/
│   │   ├── logos/                # ~690 self-hosted program logos (UUID.png)
│   │   ├── logo.png              # Runway Recruit shield logo
│   │   ├── locker-room-bg.png    # Login page background
│   │   ├── hero-bg.png, hero-bg-2.png, hero-bg-3.png  # Night/dark hero images
│   │   ├── hero-bg-day-1..3.png  # Daytime hero images
│   └── src/
│       ├── app/
│       │   ├── layout.tsx        # Root layout (fonts, metadata)
│       │   ├── page.tsx          # / → redirect or landing page
│       │   ├── login/            # Email/password + Google OAuth login
│       │   ├── register/         # New user registration
│       │   ├── forgot-password/  # Password reset request
│       │   ├── auth/
│       │   │   ├── callback/     # OAuth callback handler (PKCE exchange)
│       │   │   └── reset-password/ # Password reset form
│       │   ├── profile-setup/    # First-time profile form (post-registration)
│       │   ├── checkout/         # Stripe checkout page
│       │   ├── hub/              # Main athlete hub (post-login)
│       │   ├── [slug]/           # High school program branded login
│       │   ├── admin/            # Admin portal
│       │   ├── (app)/            # Protected route group
│       │   │   ├── layout.tsx    # Auth check + NavBar
│       │   │   ├── dashboard/
│       │   │   ├── coaches/
│       │   │   ├── pipeline/
│       │   │   ├── outreach/
│       │   │   │   └── dm/[id]/
│       │   │   └── profile/
│       │   └── api/              # API routes — see docs/api.md
│       ├── components/
│       │   ├── ui/               # 60+ shadcn/ui components
│       │   ├── campaigns/        # Campaign wizard, cards, overlays
│       │   ├── dashboard/        # Stat cards, welcome header, pipeline preview
│       │   ├── programs/         # Coach detail panel, program detail, pipeline dialog
│       │   ├── admin/            # Admin login, dashboard components
│       │   ├── landing/          # Landing page hero, sections
│       │   ├── login-ui.tsx      # Shared login form component
│       │   ├── slug-landing.tsx  # High school program branded login page
│       │   └── NavBar.tsx        # Main navigation
│       ├── hooks/
│       │   ├── use-toast.ts
│       │   └── use-gmail-token-capture.ts
│       └── lib/
│           ├── utils.ts          # cn() utility
│           ├── gmail.ts          # Gmail API: send, refresh, tracking
│           ├── workspace.ts      # Zoho Mail360: provision, send, delete
│           ├── merge-tags.ts     # ((tag)) resolution
│           ├── app-url.ts        # Dynamic URL (browser → VERCEL_URL → localhost:3001)
│           └── supabase/
│               ├── client.ts     # Browser client (anon key, persistSession, autoRefreshToken)
│               ├── server.ts     # Server client (cookie-based)
│               ├── admin.ts      # Service-role client
│               └── middleware.ts # Auth + site isolation middleware logic
├── scripts/                      # Data pipeline (coach sync, logo downloads)
├── supabase/migrations/          # SQL migrations 001–004 (012 pending)
├── docs/                         # Reference docs (you are here)
└── prep/                         # Runway Prep site (separate app, separate Supabase)
```

---

## Key Components

### NavBar (`components/NavBar.tsx`)
Sticky header, red accent stripe, centered nav, user avatar dropdown, mobile hamburger.

### Dashboard (`components/dashboard/`)
- `welcome-header.tsx` — Time-based greeting + date
- `stat-cards.tsx` — 4-card grid: Programs, Coaches, Outreach Sent, In Pipeline
- `pipeline-preview.tsx`, `action-items.tsx`, `quick-links.tsx`, `recruiting-ticker.tsx`

### Campaigns (`components/campaigns/`)
- `create-campaign-overlay.tsx` — Full-screen wizard
- Steps: goal → channel → target (division pills, program search, coach selection) → build (template) → dm-compose
- `campaign-card.tsx`, `campaign-details-overlay.tsx`, `launch-confirmation-overlay.tsx`, `campaign-launched-overlay.tsx`

### Programs (`components/programs/`)
- `coach-detail.tsx` — Slide-in panel, copy-to-clipboard contact, DM badge
- `program-detail.tsx`, `add-to-pipeline-dialog.tsx`

### Auth Components
- `login-ui.tsx` — Shared login form (email/password + Google OAuth below)
- `slug-landing.tsx` — High school program branded login page
- `admin/admin-login.tsx` — Admin portal login
- `gmail-token-capture-wrapper.tsx` — Captures Gmail OAuth tokens post-connect

---

## Design System

### Fonts
- **Inter** — body text (`font-sans`, `--font-inter`)
- **Oswald** — headings/display (`font-display`, `--font-oswald`, uppercase)

### Color Palette (HSL CSS variables)
| Token | HSL | Hex | Usage |
|-------|-----|-----|-------|
| Primary | 224 76% 30% | #1a3a6e | Buttons, nav, active states |
| Accent | 0 72% 51% | ~#d93025 | Top stripe, highlights |
| Background | 220 20% 97% | Off-white | Page background |
| Foreground | 222 47% 11% | Dark blue-gray | Body text |
| Card | 0 0% 100% | White | Card backgrounds |
| Muted | 220 14% 96% | Light gray | Secondary elements |
| Border | 220 13% 91% | Light gray | Borders, inputs |
| Sidebar BG | 224 76% 20% | Darker blue | Sidebar |

### UI Patterns
- Responsive grid: `grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4`
- Container: `max-w-7xl` with `px-4 lg:px-8`
- Icons: Lucide React
- Toasts: Sonner (1 at a time)
- Loading: Skeleton components
- Class merging: `cn()` from `lib/utils.ts` (clsx + tailwind-merge)

---

## Environment Variables

### App (Vercel)
| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public Supabase key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (API routes) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `CRON_SECRET` | Auth for cron endpoints |
| `TWITTER_CLIENT_ID` | Twitter/X OAuth client ID |
| `TWITTER_CLIENT_SECRET` | Twitter/X OAuth client secret (`:ci` suffix — confidential) |
| `ZOHO_CLIENT_ID` | Zoho Mail360 app OAuth |
| `ZOHO_CLIENT_SECRET` | Zoho Mail360 app OAuth |
| `ZOHO_REFRESH_TOKEN` | Zoho Mail360 app OAuth |
| `ZOHO_DOMAIN` | `jetstreammail.com` |
| `STRIPE_SECRET_KEY` | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `STRIPE_PRICE_MONTHLY` | $50/month price ID |
| `STRIPE_PRICE_ANNUAL` | $450/year price ID |

### Scripts
| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Direct Postgres connection |
| `RML_USERNAME` | RecruitingMasterList.com login |
| `RML_PASSWORD` | RecruitingMasterList.com login |

### Vercel-Provided
`VERCEL_URL`, `VERCEL`

---

## Middleware Flow

File: `src/middleware.ts` → `src/lib/supabase/middleware.ts`

1. Update Supabase session cookies on every request
2. Skip `getUser()` on `/auth/callback` (preserves PKCE code_verifier)
3. Check `site_session` cookie against current URL prefix → redirect to site's login if mismatch
4. If no user + protected route → redirect to appropriate login
5. If user on login page → redirect to appropriate dashboard
6. If user missing `first_name` or `position` → redirect to `/profile-setup`
7. If user has no subscription + not grandfathered → redirect to `/checkout`

---

## Vercel Cron Jobs

`app/vercel.json`:
```json
{ "crons": [{ "path": "/api/email/process-queue", "schedule": "0 9 * * *" }] }
```
Email queue runs daily at 9:00 AM UTC.
