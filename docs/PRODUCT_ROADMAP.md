# Gridiron Elite Recruiting — Product Roadmap

Last updated: 2026-02-11

---

## 🏈 Vision

A recruiting CRM that gives high school football athletes a real edge in the college recruiting process. Not another place for coaches to browse recruits — that's Twitter and a million other sites. This is the athlete's command center: manage outreach, track interest, and present themselves professionally to coaches.

---

## Phase 1: Core CRM (Current — MVP)

### Dashboard
- Personalized greeting, quick stats, action items
- NCAA recruiting calendar/deadline ticker
- Pipeline stage overview at a glance

### Programs Database
- Searchable/filterable database of college programs + coaches
- Contact info, social handles, DM status
- Source data from ContactCollegeCoaches.com + RecruitingMasterList.com

### Pipeline (Kanban)
- 5 stages: Initial Contact → Evaluation → Interest → Campus Visit → Offer
- Drag-and-drop cards between stages
- Team logos, quick details on hover
- **Future:** When athlete commits, that school's brand takes over the pipeline with a congratulations experience

### Outreach
- Email/message templates
- Template variables populated from athlete profile + program data
- Track sent outreach, follow-ups

---

## Phase 2: Athlete Profile & Media Portfolio ⭐

### Athlete Profile Page (Internal)
- Full editable profile: name, grad year, position, height, weight, GPA, school, city, state
- Athletic stats: 40 time, bench, squat, vertical, shuttle, etc.
- Hudl link, Twitter/X handle, highlight reel URLs
- Profile photo / headshot
- This data feeds into outreach templates automatically

### Recruiting Portfolio (Public Shareable Page) ⭐⭐⭐
**The killer feature.**

Each athlete gets a branded, shareable profile page:
`gridironeliterecruiting.com/athlete/will-clausen-2027`

**What it includes:**
- Professional layout with GER branding
- Athlete photo, stats, bio, school info
- Organized media sections:
  - 🎬 **Film** — Hudl/YouTube links (embedded, not stored)
  - 📄 **Academics** — Transcripts, test scores (uploaded PDFs)
  - 📸 **Photos** — Action shots, team photos (uploaded images)
  - 🏆 **Awards & Recognition** — All-district, all-metro, etc. (uploaded images/PDFs)
  - 📋 **Resume** — Football resume PDF
  - 📊 **Scouting Reports** — Third-party evaluations
  - 🏋️ **Training** — Training videos, workout logs
  - 🔗 **Additional Links** — Anything else (Google Drive, MaxPreps, etc.)
- Athletes can mark items as private/public or "do not share publicly"
- Clean, mobile-friendly — coaches will view this on their phones

**Inspiration:** Will Clausen's Google Drive recruiting folder (https://drive.google.com/drive/folders/1uOoUzYpmcOMrHQr04p2VqSl44FrbvWOI) — same content, but branded, professional, and trackable.

### Coach View Analytics ⭐⭐⭐
**This is the money feature. Nobody else does this.**

When a coach clicks the athlete's profile link:
- Track that Coach Smith at Iowa opened the profile on Tuesday at 2:14 PM
- Track what they viewed: film, transcript, resume
- Track how long they spent
- Track repeat visits ("Coach Smith has viewed your profile 3 times this week")

**What the athlete sees:**
- Dashboard notification: "🔥 Coach Smith (Iowa) viewed your profile"
- Analytics page: which coaches are looking, how often, what content
- This tells the athlete where real interest is — priceless recruiting intel

**Implementation:** UTM-style tracking links per coach, or unique links per outreach. Simple analytics table in Supabase.

### Storage Plan
- **Videos:** NOT stored — link to Hudl, YouTube, Google Drive (saves massive storage costs)
- **Everything else:** Uploaded to Supabase Storage buckets (PDFs, images, docs)
- **At 200 users × ~1GB each = 200GB — approximately $5-10/month**
- Very feasible at the expected user scale

### Optional: Google Drive Integration
- Allow athletes to connect an existing Google Drive folder
- Display contents on their profile page
- Bridge feature for athletes already using Drive
- Lower priority than native uploads — native is cleaner

---

## Phase 3: Access Control & Monetization

### Registration Flow
**Decision needed — two options:**

#### Option A: Gated Registration (Purchase First)
- Athlete purchases product → we activate their email → they can register
- Simpler, but no funnel — you only see paying customers

#### Option B: Freemium / Tour Mode (Recommended) ⭐
- Anyone can register for free
- Free tier: see a guided tour with sample data, browse programs database
- Paid tier: unlock pipeline, outreach, media portfolio, coach analytics
- **Benefit:** Every signup is a lead. They experience the value before buying.
- **Implementation:** `account_status` field on profile (tour/active/expired)
- Middleware check on protected pages → "Upgrade to unlock" overlay

### Pricing Thoughts
- Higher price point justified by:
  - Coach view analytics (unique feature)
  - Professional shareable portfolio (replaces janky Google Drive)
  - Full CRM pipeline + outreach tools
  - Direct value: helps earn scholarships worth $10K-$200K+
- Max couple hundred users — premium product, not mass market
- Consider annual subscription aligned with recruiting calendar

---

## Phase 4: Future Ideas (Parking Lot)

- **Commitment Celebration:** When athlete commits, their school's brand takes over the pipeline page with a congratulations experience
- **Email Integration:** Send outreach directly from the app (not just templates)
- **Twitter/X Integration:** Monitor coach activity, DM tracking
- **Parent/Guardian Access:** Shared view for parents to monitor recruiting progress
- **Coach Recommendation Engine:** "Based on your stats and location, consider these programs"
- **Recruiting Timeline:** Visual timeline of the full recruiting journey
- **Export:** Generate recruiting resume PDF from profile data
- **Mobile App:** React Native wrapper for on-the-go updates

---

## Technical Architecture

- **Frontend:** Next.js + Tailwind + shadcn/ui
- **Backend:** Supabase (Auth + PostgreSQL + Storage + Edge Functions)
- **Hosting:** Vercel
- **File Storage:** Supabase Storage (images, PDFs, docs)
- **Video:** External links only (Hudl, YouTube, Google Drive)
- **Analytics:** Custom tracking table in Supabase
- **Domain:** gridironeliterecruiting.com (TBD)

---

## User Scale Assumptions

- Target: ~200 active athletes max
- Storage: ~200GB at peak ($5-10/mo)
- Database: Well within Supabase free/pro tier
- This is a premium niche product, not a mass-market play
