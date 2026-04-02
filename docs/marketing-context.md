# Runway Recruit — Marketing Context Document

> Use this document as context for Claude.ai conversations about marketing strategy, ad copy, email sequences, landing page variants, and audience targeting.

---

## What Runway Recruit Is

Runway Recruit is a SaaS recruiting platform for high school football athletes. It gives players (and their coaches/families) the tools to run a real recruiting campaign — reaching college coaches, tracking responses, and managing the process like a professional operation.

**Live at**: runwayrecruit.com
**Brand metaphor**: Airplane/runway — "take off," "take flight," "the runway to your future"

---

## The Core Problem

Most high school football athletes have no system for recruiting. They train hard, get good grades, and hope a college coach notices them. But getting recruited is a separate competition — one that requires outreach, follow-up, and organization. The families who figure this out hire expensive recruiting services ($2,000–$10,000+) or stumble through it on their own with spreadsheets and Gmail.

Runway Recruit replaces all of that with a $50/month platform.

---

## Product Features

### 1. Coach Database (10,000+ coaches)
Every college football program in America — FBS, FCS, Division II, Division III, NAIA, and JUCO. Each coach record includes name, title, email, Twitter/X handle, and DM availability. Filter by division, conference, or search by name. Sourced from RecruitingMasterList.com, synced bi-weekly via automated scraper. ~690 school logos self-hosted for instant recognition.

### 2. Email Campaigns (Recruiting Drives)
Personalized mass outreach to college coaches using merge tags. The athlete writes one template and sends it to 50+ coaches — each email is personalized with the coach's name, school, the player's film link, GPA, position, etc.

- Professional recruiting email address provisioned automatically (name@jetstreammail.com)
- Open/click tracking (pixel + link wrapping)
- Unsubscribe handling (CAN-SPAM compliant)
- Follow-up sequences (multi-step campaigns with delays)
- Built-in templates for common outreach types (film evaluation, coach reference, etc.)

### 3. X (Twitter) DM Campaigns
Many college coaches have open DMs on X. Athletes can:
- See which coaches accept DMs
- Write a DM template with merge tags
- Send DMs directly from the platform (via Twitter API) or copy/paste manually
- Track which coaches have been contacted

### 4. Recruiting Pipeline (CRM)
Visual Kanban board tracking each program through 5 stages:
- Initial Contact → Film Evaluation → Showing Interest → Campus Visit → Offer

Drag-and-drop interface. One entry per program. Shows school logo, division, primary coach contact. Gives the athlete (and their family) a clear picture of where they stand.

### 5. In-App Email (Inbox + Sent)
When a coach replies to a recruiting email, it shows up in the app's inbox. Athletes can read and reply without leaving the platform. Sent emails are organized by campaign. Filing system sorts conversations by Division → Conference → School → Coach.

### 6. Recruiting Drive Page (Coming Soon — Film Hosting)
Shareable URL: `runwayrecruit.com/film/{username}`
Coach clicks the link → branded page with instant video playback (no login, no pre-roll). Tracks: plays, watch %, rewatches, time spent. Real-time notification to athlete when a coach watches their film. **No competitor does this today** — Hudl requires a coach account for analytics.

---

## Pricing

**Simple, transparent pricing. No tiers, no add-ons.**

| Plan | Price | Note |
|------|-------|------|
| Monthly | $50/month | Cancel anytime |
| Annual | $450/year | Save 25% ($37.50/mo effective) |

Full access to everything. One price. No upsells.

Payment via Stripe. Credit card required at signup (no free trial currently).

---

## User Flow

```
1. Landing page (runwayrecruit.com)
   ↓ Click "Get Started"
2. Register (email/password or Google OAuth)
   ↓
3. Checkout (choose monthly or annual, enter payment)
   ↓
4. Profile Setup (name, position, grad year, high school, GPA, Hudl link, film link, measurables)
   ↓ Recruiting email auto-provisioned (name@jetstreammail.com)
5. Dashboard/Hub — start recruiting
```

### For High School Coaches (B2B path)
Coaches access the platform through a branded program URL (e.g., `runwayrecruit.com/prairie-ia`). They manage their roster of athletes, send campaigns on behalf of players, and track recruiting across the whole team. The coach sees one player at a time and can switch between athletes.

### Grandfathered Users
Early adopters bypass checkout and go straight to the dashboard. Flag: `profiles.is_grandfathered = true`.

---

## Current Landing Page Messaging

**Headline**: "The Recruiting Game Starts Here"
**Subhead**: "You compete on the field and in the classroom. It's time to compete for exposure."
**Key line**: "The athletes who get recruited didn't just train harder. They prepared smarter — and they started earlier."
**CTA**: "Ready to Take Off?"

### The Three-Pillar Framework
The landing page positions recruiting as a three-part formula:
1. **Athletic Ability** — coaching, training, dedication (athlete handles this)
2. **Academic Accomplishments** — grades, classroom performance (athlete handles this)
3. **Exposure** — reaching coaches, managing outreach, recruiting presence (**This is what Runway Recruit provides**)

Message: You're already handling #1 and #2. But without #3, coaches don't even know you exist.

---

## Target Audience

### Primary: High School Football Athletes (and their parents)
- **Age**: 14–18 (athletes), 35–55 (parents who pay)
- **Buyer**: Almost always the parent. The athlete is the user.
- **Geography**: National, but strongest in football-heavy states (Texas, Florida, Ohio, Georgia, California, Pennsylvania, Iowa)
- **Psychographic**: Families who believe their son has college-level talent but don't know how to get noticed. Often feeling overwhelmed by the recruiting process. May have been told "coaches will find you if you're good enough" — which isn't true.
- **Income**: Middle class to upper-middle. $50/month is accessible but not trivial — they need to believe it works.
- **Timing**: Recruiting awareness peaks in sophomore/junior year. Seniors are often too late (but may still buy out of urgency).
- **Grad years in play**: Class of 2026, 2027, 2028, 2029

### Secondary: High School Football Coaches
- Want to help their players get recruited but don't have time to manage individual outreach
- Runway Recruit lets them send campaigns on behalf of their athletes
- B2B sale — coach signs up, manages multiple athletes
- Price sensitivity: may need school/booster funding

### Who We Are NOT For
- D1 blue-chip prospects (they already have offers and agents)
- Non-football sports (football only, for now)
- College coaches (they are the recipients, not users)

---

## Competitive Landscape

| Competitor | Price | What They Do | Our Advantage |
|------------|-------|-------------|---------------|
| NCSA | $2,000–$10,000+ | Profile page + advisor calls | 40x cheaper. We give tools, not hand-holding. |
| BeRecruited | Free (limited) | Profile page | No outreach tools. Static profile only. |
| Hudl | Free–$200/yr | Film hosting | No email/DM outreach. No pipeline. No recruiting system. |
| SportsRecruits | Varies | Profile + messaging | Expensive. No mass outreach. No pipeline CRM. |
| DIY (Gmail + spreadsheet) | Free | Manual everything | We automate what takes families 10+ hours/week. |

**Our moat**: No one combines coach database + personalized mass email + DM campaigns + pipeline CRM + film tracking in one platform at $50/month. The closest alternatives are 10-40x more expensive or only cover one piece of the puzzle.

---

## Key Differentiators (for ad copy)

1. **10,000+ verified college coaches** — every division, every conference, emails and Twitter handles
2. **Personalized mass outreach** — one template, 50+ personalized emails in minutes
3. **$50/month, no tiers** — vs. $5,000+ for NCSA. Cancel anytime.
4. **Built-in pipeline/CRM** — know exactly where you stand with every program
5. **Your own recruiting email** — professional name@jetstreammail.com address
6. **X/Twitter DM campaigns** — reach coaches where they actually are
7. **Film tracking** (coming soon) — know when coaches watch your film, how long, and how many times

---

## Messaging Angles for Ads

### For Parents (the buyer)
- "Your son works too hard to be invisible to coaches."
- "Recruiting isn't a waiting game. It's a system."
- "NCSA charges $5,000. We charge $50/month. Same goal, better tools."
- "10,000+ college coaches. One platform. Your son's name in their inbox."
- "The difference between recruited and overlooked? A system."

### For Athletes
- "Stop hoping coaches find you. Put yourself in front of them."
- "Your film is fire. But if coaches never see it, does it matter?"
- "Every D1 commit had a plan. Here's yours."
- "Recruiting is a game. This is how you win it."

### For Coaches
- "Your athletes deserve more than a Hudl link and a prayer."
- "Send personalized recruiting emails for your entire roster in minutes."
- "Help your players get recruited without adding 10 hours to your week."

### Urgency/Timing
- "Class of 2027: recruiting starts now, not senior year."
- "Coaches fill rosters early. Late outreach = missed opportunities."
- "89% of college football players were NOT heavily recruited. They had to earn their spot."

---

## Edge Cases & Nuances

### No Free Trial — By Design
There is deliberately NO free trial. Reasons:
1. **Abuse vector**: A free trial with full email send access lets anyone blast thousands of college coaches — rival fans sending trash talk, non-serious users wasting coaches' time, people extracting value (send campaigns, get coach responses, build relationships) and canceling before paying.
2. **Product demo video instead**: A 60-second screen recording showing the coach database, email campaigns, pipeline, and Recruiting Drive is the conversion lever. For families in this market, seeing the product in action is a "holy shit, this exists?" moment. The strategy is to drive video views, not free signups.
3. **Conversion math**: Industry benchmarks say cold traffic to $50 converts at 0.5–1.5%, and a 7-day trial with card converts at 3–6%. But those benchmarks assume generic SaaS. This product is highly targeted at a passionate audience. A compelling demo video shown to hyper-targeted families (see Go-To-Market below) will blow past those numbers without the abuse risk of a free trial.

### Grandfathered Users
Some early users were given free access. They bypass checkout entirely. This creates a two-tier experience that should be handled carefully in any referral or word-of-mouth campaigns.

### Football Only
The coach database is football-specific. Do not market to other sports. The data, templates, and pipeline stages are all football-recruiting specific.

### Compliance
- CAN-SPAM compliant (unsubscribe in every email)
- NCAA rules: athletes can email coaches. There are no restrictions on athletes initiating contact. Coaches have contact restrictions, not athletes.
- No FERPA concerns — athletes voluntarily share their own information
- COPPA: The main platform is for 14+ (high school athletes). The separate Runway Prep product (for younger athletes) uses a parent-first auth model.

### Platform Maturity
- **Live and working**: registration, checkout, email campaigns, DM campaigns, pipeline, coach database, in-app email
- **Coming soon**: film hosting with tracking (high-priority differentiator)
- **Technical stack**: Next.js, Supabase, Stripe, Vercel, Zoho Mail360 — all on paid/pro plans, scalable

---

## Brand Assets

- **Logo**: Shield emblem (app/public/logo.png)
- **Colors**: Primary red `#d93025`, dark navy/black `#04080f`, secondary blue `#1a3a6e`
- **Fonts**: Display font for headings (uppercase, bold, tight tracking), clean sans-serif for body
- **Imagery**: Dark/dramatic (stadium lights, night games, fighter jets for the "runway" metaphor)
- **Tone**: Confident, direct, competitive. Speaks to athletes like a coach — no fluff, no corporate speak.

---

## Metrics (Current State — Pre-Launch)

- 45 user profiles in database
- 10 active paying subscribers (all monthly)
- 12,358 coaches in database across all divisions
- 897 college programs with logos
- ~178 emails sent through the platform
- 35 campaigns created

These are early/beta numbers. The platform is built and functional — marketing is the next phase.

---

## What "Launch to the Masses" Means

The product is live and working. Infrastructure is on paid plans (Vercel Pro, Supabase Pro, Stripe live, Zoho Mail360 paid). The platform can handle hundreds of users without changes. Code optimizations for thousands of concurrent users are identified and on the roadmap but not blocking.

The bottleneck is not technology — it's awareness. Marketing is the unlock.

---

## Go-To-Market Strategy

### Primary Channel: Midwest 7-on-7 Football League Email Blast
The first marketing push is an email campaign to all participants in a Midwest regional 7-on-7 football series — thousands of kids and parents who:
- Take football seriously enough to travel all over for competitive 7-on-7
- Are already spending money on their kid's football development
- Are in the exact demographic (sophomore/junior families thinking about recruiting)
- **Trust the sender** — the email comes from the league itself, not a cold brand

The email includes:
- League endorsement of Runway Recruit
- A discount code (exclusive to league participants)
- Link to the 60-second product demo video

This is **hyper-targeted, warm, endorsed traffic with a discount incentive**. This is not cold Facebook ads — this is a trusted organization telling its members "this tool exists and we recommend it."

### Conversion Funnel
```
League email (trusted sender + discount)
  ↓ Click to watch demo video
60-second screen recording (coach database → campaign → pipeline → Recruiting Drive)
  ↓ CTA: "Get Started" with discount code
Checkout ($50/mo or $450/yr, discount applied)
  ↓
Profile setup → Dashboard → First campaign
```

**The #1 KPI is video views.** If they watch the video, they convert. The entire funnel is designed to get the demo in front of the right eyes.

### Content Strategy: The Demo Video
The single most valuable marketing asset is a 60-second screen recording of the actual product:
- Show the coach database (10,000+ coaches, filter by division)
- Show building an email campaign (select coaches, pick template, merge tags auto-fill)
- Show the pipeline (drag a program from Contact to Film Eval)
- Show the Recruiting Drive page
- Simple narration, no agency, no production budget needed
- This video outperforms any static graphic across every channel

### Future Channels (after 7-on-7 launch)
- Meta/Instagram ads targeting football parents (requires Meta Pixel + GA4 first)
- Twitter/X ads targeting high school football accounts
- High school coach referral program
- Football camp and combine partnerships
- Word of mouth from early users

### Pre-Advertising Checklist
Before spending money on paid ads:
- [ ] Meta Pixel installed on runwayrecruit.com
- [ ] GA4 tracking conversions (registration, checkout, payment)
- [ ] 60-second demo video recorded and hosted
- [ ] Discount/promo code system tested end-to-end
- [ ] Landing page variant for ad traffic (video-first layout)
