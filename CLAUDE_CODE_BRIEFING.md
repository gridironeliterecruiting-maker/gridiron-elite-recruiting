# Gridiron Elite Recruiting - Complete Project Briefing for Claude Code

## Project Overview
Gridiron Elite Recruiting is a web application that helps high school football athletes navigate the college recruiting process and earn scholarships. It provides tools to research college programs, manage coach communications, and run email outreach campaigns.

**Live URL:** https://gridironeliterecruiting.com
**GitHub:** https://github.com/gridironeliterecruiting-maker/gridiron-elite-recruiting
**Primary Users:** High school football players (currently Cael Kongshaug and Bubba Donald, both juniors)

## Technical Stack

### Frontend
- **Framework:** Next.js 15.0.4 (App Router)
- **UI Library:** React 19
- **Styling:** Tailwind CSS
- **Components:** Custom components, Radix UI primitives
- **Icons:** Lucide React
- **Drag & Drop:** @dnd-kit

### Backend
- **Database:** PostgreSQL via Supabase
- **Authentication:** Supabase Auth (using Google OAuth)
- **API:** Next.js API routes
- **Email Sending:** Gmail API (direct integration)

### Infrastructure
- **Hosting:** Vercel (automatic deployments from GitHub)
- **Database Host:** Supabase (ufmzldfkdpjeyvjfpoid.supabase.co)
- **Domain:** GoDaddy → Vercel
- **Environment:** Node.js

## Project Structure
```
gridiron-elite-recruiting/
├── app/                    # Next.js app directory
│   ├── src/
│   │   ├── app/           # Page routes and API routes
│   │   ├── components/    # React components
│   │   ├── lib/          # Utilities and helpers
│   │   └── types/        # TypeScript types
│   ├── public/           # Static assets (logos, etc.)
│   └── package.json      # Dependencies
├── assets/               # Mockups and design files
├── docs/                # Documentation
└── supabase/            # Database migrations and types
```

## Key Features

### 1. Authentication
- Google OAuth via Supabase Auth
- Profile setup required (name, position, school, etc.)
- Session management handled by Supabase

### 2. Dashboard
- Shows recruiting metrics (programs tracked, coaches in DB, outreach sent, pipeline)
- Quick links to browse programs and manage pipeline
- Updates section for recruiting tips

### 3. Programs Browser
- Browse and search college football programs
- Filter by division, conference, state
- Add programs to tracking list
- View program details

### 4. Coach Database
- 10,979 coaches loaded from ContactCollegeCoaches.com
- Search by name, position, school
- View coach contact information
- Track communication history

### 5. Email Campaign System
**4-Step Wizard:**
1. **Goal Selection** - Choose campaign objective
2. **Target Coaches** - Smart filtering and selection
3. **Build Email** - Templates and customization
4. **Launch** - Review and send

**Email Integration:**
- Direct Gmail API integration
- OAuth connection per user
- Automatic token refresh (every 45 minutes via cron)
- Templates for different campaign types

### 6. CRM/Pipeline
- Track recruiting progress with each program
- Drag-and-drop interface
- Stages: Interested → Questionnaire → Campus Visit → Offer → Committed
- Notes and communication history per program

## Database Schema

### Key Tables

**profiles**
- id (uuid) - matches auth.users.id
- email, first_name, last_name, phone
- position, school_name, city, state
- grad_year, height, weight, gpa
- social media links
- can_send_emails (boolean) - email permission flag

**programs**
- id, name, division, conference
- city, state, head_coach
- stadium info, logos, colors
- ranking, total_commits

**coaches**
- id, first_name, last_name
- position, school, email
- division, state
- bio

**campaigns**
- id, profile_id, name
- type, status (draft/active)
- config (JSONB) - wizard data
- metrics (sent/opened/replied)

**gmail_tokens**
- profile_id, email
- access_token, refresh_token
- expires_at
- account_tier (new/building/established/veteran)

**tracked_programs**
- Junction table between profiles and programs

**pipeline_programs**
- profile_id, program_id
- stage, position, notes

## Authentication Flow

1. User clicks "Sign in with Google"
2. Redirects to Supabase OAuth → Google → Back to app
3. Supabase creates/updates user and sets session cookies
4. Middleware checks session on each request
5. Profile setup required if incomplete

**Note:** There's a brief moment where users see "ufmzldfkdpjeyvjfpoid.supabase.co" during OAuth. This is a known UX issue. Solutions:
- Upgrade to Supabase Pro ($25/mo) for custom domain
- Live with it (current choice)

## Email System Architecture

### Safety Layers (CRITICAL - NEVER REMOVE)
1. **Kill Switch:** `system_settings.email_sending_enabled` must be true
2. **User Permission:** `profiles.can_send_emails` must be true (checked twice)
3. **Recipient Allowlist:** Only emails in `email_allowlist` table can receive
4. **RLS:** Users cannot modify their own `can_send_emails` flag

### Gmail Integration
- Each user connects their Gmail account
- Tokens stored encrypted in database
- Automatic refresh via cron job (every 45 minutes)
- Email tier system based on account age

### Current Status
- Only Cael and Bubba approved for sending
- Daily send limits based on Gmail account age
- No email sending on staging environment

## Environment Variables

Required in Vercel:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
CRON_SECRET
```

## Deployment

### Production
- Branch: `main`
- Auto-deploys to Vercel on push
- URL: https://gridironeliterecruiting.com

### Staging
- Branch: `staging`
- URL: https://staging.gridironeliterecruiting.com
- Yellow banner indicates staging environment
- Email sending disabled

### Local Development
```bash
cd app
npm install
npm run dev
# Runs on http://localhost:3001
```

## Important Notes

1. **Gmail Tokens:** Must be refreshed regularly or emails will fail
2. **Coach Data:** Loaded from paid services ($400/year total)
3. **Email Safety:** Multiple layers prevent accidental mass emails
4. **RLS Policies:** Database has row-level security for multi-tenant isolation
5. **No Instantly.ai Yet:** Considered but not implemented
6. **Mobile:** Not optimized for mobile yet

## Common Tasks

### Update Coach Database
1. Get new CSV from ContactCollegeCoaches.com
2. Upload to `/home/ubuntu/.openclaw/workspace/gridiron-elite-recruiting/coaches/contact_for_players.csv`
3. Run migration script (needs to be created)

### Grant Email Access
1. Update `profiles` table: `can_send_emails = true`
2. Add recipient emails to `email_allowlist` table
3. Verify kill switch is enabled

### Debug Email Issues
1. Check Gmail token expiration
2. Verify user has `can_send_emails = true`
3. Check recipient is in allowlist
4. Review `/api/email/send` logs in Vercel

### Add New User
1. User signs in with Google (automatic)
2. Completes profile setup
3. Admin grants email permissions if needed

## Recent Issues & Solutions

### Staging/Preview Redirects (RESOLVED)
- Preview deployments redirected to production after login
- Fixed by dynamic URL detection in auth callbacks

### Gmail Token Expiration (RESOLVED)
- Tokens expired after 1 hour
- Solution: Cron job refreshes every 45 minutes

### Email Not Sending (RESOLVED)
- Multiple issues with auth and permissions
- Solution: 4-layer safety system + proper token management

## Contacts
- **Developer:** Paul Kongshaug
- **Athletes:** Cael Kongshaug, Bubba Donald
- **School:** Prairie High School, Cedar Rapids, Iowa

## Next Steps
1. Monitor email deliverability
2. Add more athletes
3. Improve mobile experience
4. Consider email warming service
5. Add analytics tracking