# Email Campaign UI Design — Gridiron Elite Recruiting

> Comprehensive recommendation document for building email campaign features into the Gridiron Elite Recruiting app. Backend powered by Instantly.ai API V2.

**Last Updated:** 2026-02-11  
**Status:** Research & Recommendations

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Instantly.ai API Integration Layer](#2-instantlyai-api-integration-layer)
3. [Campaign Creation UI](#3-campaign-creation-ui)
4. [Visual Workflow / Sequence Builder](#4-visual-workflow--sequence-builder)
5. [Template System](#5-template-system)
6. [Analytics Dashboard](#6-analytics-dashboard)
7. [Contact / List Management](#7-contact--list-management)
8. [Recruiting-Specific Email Templates](#8-recruiting-specific-email-templates)
9. [Industry Benchmarks & Best Practices](#9-industry-benchmarks--best-practices)
10. [MVP vs Future Phases](#10-mvp-vs-future-phases)
11. [Technical Architecture Notes](#11-technical-architecture-notes)

---

## 1. Executive Summary

Gridiron Elite Recruiting helps high school football athletes run structured email outreach to college coaches, moving relationships through a recruiting pipeline: **Introduction → Interest → Campus Visit → Offer**. 

The email system must feel simple enough for a 16-year-old athlete (or their parent) while being powerful enough to run multi-step automated sequences with personalization. We leverage **Instantly.ai** as the email execution engine and build a recruiting-optimized UI on top.

### Key Design Principles
- **Simplicity first** — wizard-style flows, not power-user dashboards
- **Recruiting context everywhere** — pipeline stages, not generic "campaigns"
- **Mobile-friendly** — athletes live on their phones
- **Guided experience** — pre-built templates and recommended sequences, not blank canvases

---

## 2. Instantly.ai API Integration Layer

### What Instantly Exposes (API V2)

| API Domain | Key Endpoints | What We Use It For |
|---|---|---|
| **Campaign** | Create, update, list, get, activate, pause, delete | Creating and managing outreach sequences |
| **Campaign Sequences** | Steps array with subject/body/delay | Multi-step email sequences (the core) |
| **Campaign Subsequences** | Conditional follow-up paths | Branching based on engagement |
| **Lead** | Add, update, list, delete, update interest status | Managing coach contacts within campaigns |
| **Lead List** | Create, list, manage lists | Organizing coaches by segment |
| **Lead Labels** | Custom labels for leads | Pipeline stage tracking |
| **Account** | List/manage sending accounts | Email account management |
| **Analytics** | Campaign-level analytics | Open rates, reply rates, bounce data |
| **Email** | Read sent/received emails (Unibox) | Conversation threading |
| **Email Verification** | Single email verification | Validating coach emails |
| **Custom Tags** | Tag campaigns and accounts | Organization |
| **Webhooks** | Event-driven notifications | Real-time updates (reply received, email opened, etc.) |
| **Background Jobs** | Long-running task management | Bulk imports, enrichment |

### What We Build Custom (Not in Instantly)

| Feature | Why Custom |
|---|---|
| **Recruiting pipeline UI** | Instantly has generic lead statuses; we need Intro → Interest → Visit → Offer stages |
| **Template gallery with recruiting context** | Instantly has no template marketplace; we curate recruiting-specific templates |
| **Coach database & school metadata** | School/division/conference data is our domain; Instantly just has leads |
| **Per-coach engagement timeline** | Instantly analytics are campaign-level; we need coach-level relationship views |
| **Campaign wizard** | Instantly's UI is for sales pros; our users need guided, simplified creation |
| **Mobile-optimized dashboard** | Instantly is desktop-first |

### Key Instantly Limitations to Design Around

1. **Single sequence per campaign** — The `sequences` array only uses the first element. For A/B testing, use Instantly's built-in variant system (multiple variants per step).
2. **No native conditional branching in sequences** — Use **Campaign Subsequences** for "if replied, do X" logic. This is a separate API entity.
3. **Analytics granularity** — Campaign-level metrics come from `/api/v2/analytics`. For per-lead engagement, poll lead status + email endpoints.
4. **Rate limits** — Plan-dependent. Implement caching and background sync on our side.
5. **Webhook reliability** — Use webhooks for real-time + periodic polling as fallback for analytics sync.
6. **Lead interest statuses** — Instantly has its own lead interest values. Map these to our pipeline stages via our backend.

---

## 3. Campaign Creation UI

### Recommended Approach: Wizard Flow (Not a Dashboard)

Unlike Mailchimp/HubSpot which dump users into complex editors, our audience needs a **step-by-step wizard**. Reference: **Lemlist's campaign creation wizard** (step-by-step), simplified further.

### Wizard Steps

#### Step 1: Choose Your Goal
```
┌─────────────────────────────────────────────┐
│  What do you want to do?                    │
│                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐    │
│  │ 📬      │  │ 🔄      │  │ 🏟️      │    │
│  │ First   │  │ Follow  │  │ Visit   │    │
│  │ Contact │  │ Up      │  │ Invite  │    │
│  └─────────┘  └─────────┘  └─────────┘    │
│                                             │
│  ┌─────────┐                                │
│  │ 🎯      │                                │
│  │ Custom  │                                │
│  │ Campaign│                                │
│  └─────────┘                                │
└─────────────────────────────────────────────┘
```
Each goal pre-selects a template sequence and pipeline stage context.

#### Step 2: Select Coaches
- Pull from coach database (pre-built or imported)
- Filter by: Division (D1/D2/D3/NAIA/JUCO), Conference, State, School Size
- Show coach cards with school logo, name, title, program info
- "Smart suggestions" based on athlete profile match

#### Step 3: Customize Your Emails
- Pre-filled template based on Step 1 selection
- **Simple rich-text editor** (NOT drag-and-drop blocks — recruiting emails should be plain text for deliverability)
- Merge tag insertion via dropdown: `{{coach_name}}`, `{{school_name}}`, `{{position}}`, `{{athlete_name}}`, `{{highlight_video_link}}`, `{{gpa}}`, `{{40_time}}`, etc.
- Subject line field with character count and emoji picker
- **Preview pane** showing merged output for a selected coach

#### Step 4: Set Your Schedule
- Sequence timing: "Send follow-up after X days if no reply"
- Sending window: Weekdays 8am-5pm (coach's timezone) — pre-configured as default
- Start date picker
- Daily send limit recommendation based on number of coaches

#### Step 5: Review & Launch
- Summary card showing: # coaches, # emails in sequence, schedule, preview of first email
- "Launch Campaign" button with confirmation modal

### Merge Tags / Personalization

**Core merge tags for recruiting:**

| Tag | Source | Example |
|---|---|---|
| `{{coach_name}}` | Coach database | "Coach Johnson" |
| `{{coach_first_name}}` | Coach database | "Mike" |
| `{{school_name}}` | Coach database | "University of Texas" |
| `{{position_group}}` | Coach database | "Defensive Coordinator" |
| `{{athlete_name}}` | User profile | "Marcus Williams" |
| `{{grad_year}}` | User profile | "2027" |
| `{{position}}` | User profile | "Outside Linebacker" |
| `{{gpa}}` | User profile | "3.8" |
| `{{highlight_link}}` | User profile | Hudl/YouTube link |
| `{{height_weight}}` | User profile | "6'2\" / 215 lbs" |
| `{{40_time}}` | User profile | "4.52" |
| `{{school_name_hs}}` | User profile | "Lincoln High School" |
| `{{city_state}}` | User profile | "Dallas, TX" |

These map to Instantly's custom variables on the lead object.

### Subject Line Tools

- **Pre-written subject line suggestions** per campaign type (most impactful for MVP)
- Character count indicator (keep under 50 chars)
- Personalization tag insertion
- **Future:** A/B subject line testing (Instantly supports variants per step)

---

## 4. Visual Workflow / Sequence Builder

### MVP: Linear Sequence Builder

For MVP, implement a **linear step list** (not a visual flowchart). This matches what Instantly actually supports — a single sequence with ordered steps.

```
┌─────────────────────────────────────────────┐
│  📧 Step 1: Introduction Email              │
│  Subject: Interested in {{school_name}}...  │
│  [Edit] [Preview]                           │
├─────────────────────────────────────────────┤
│  ⏱️ Wait 3 days (if no reply)               │
│  [Change timing ▾]                          │
├─────────────────────────────────────────────┤
│  📧 Step 2: Follow-Up                       │
│  Subject: Re: Interested in {{school_name}} │
│  [Edit] [Preview]                           │
├─────────────────────────────────────────────┤
│  ⏱️ Wait 5 days (if no reply)               │
│  [Change timing ▾]                          │
├─────────────────────────────────────────────┤
│  📧 Step 3: Value Add (Highlight Reel)      │
│  Subject: New highlight film — {{position}} │
│  [Edit] [Preview]                           │
├─────────────────────────────────────────────┤
│  ⏱️ Wait 7 days (if no reply)               │
│  [Change timing ▾]                          │
├─────────────────────────────────────────────┤
│  📧 Step 4: Breakup / Last Touch            │
│  Subject: One last note, Coach              │
│  [Edit] [Preview]                           │
└─────────────────────────────────────────────┘
│  [+ Add Step]                               │
```

**Key UI elements:**
- Drag handles on each step for reordering
- Timing selector: dropdown with "1 day / 2 days / 3 days / 5 days / 7 days / 14 days / Custom"
- Step type indicator icons (email, wait)
- Collapse/expand for long sequences
- "Stop on reply" toggle (enabled by default — maps to `stop_on_reply` in Instantly API)

### Phase 2: Visual Flowchart Builder

After MVP, add a **node-based visual builder** (like HubSpot Workflows or Lemlist's sequence builder):

```
  ┌──────────────┐
  │ Start: Send  │
  │ Intro Email  │
  └──────┬───────┘
         │
    ┌────▼────┐
    │Wait 3d  │
    └────┬────┘
         │
   ┌─────▼──────┐
   │  Opened?   │
   └──┬─────┬───┘
  Yes │     │ No
 ┌────▼──┐ ┌▼────────┐
 │Follow │ │Resend w/│
 │Up #1  │ │new subj │
 └───────┘ └─────────┘
```

**Implementation:** Use Instantly's **Campaign Subsequences** API for branching. Conditions available:
- Lead replied
- Lead opened (via open tracking)
- Lead clicked link
- No engagement after X days

**Recommended library:** React Flow (reactflow.dev) for the visual node editor.

### Timing Controls

| Setting | Default | Instantly Field |
|---|---|---|
| Delay between steps | 3 days | Step-level `delay` |
| Sending window | Mon-Fri 8am-5pm | `campaign_schedule.schedules` |
| Email gap (same day) | 10 min | `email_gap` |
| Random delay variance | 0-10 min | `random_wait_max` |
| Daily send limit | 50/day | `daily_limit` |
| Daily new leads limit | 25/day | `daily_max_leads` |

---

## 5. Template System

### Template Gallery UI

```
┌─────────────────────────────────────────────────────┐
│  📋 Email Templates                                 │
│                                                     │
│  [All] [Introduction] [Follow-Up] [Visit] [Offer]  │
│                                                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐│
│  │ ⭐ Cold Intro │ │ 🔥 Highlight │ │ 🏟️ Visit     ││
│  │              │ │ Share        │ │ Request      ││
│  │ 4 emails     │ │ 3 emails     │ │ 2 emails     ││
│  │ 87% avg open │ │ 72% avg open │ │ 64% avg open ││
│  │ [Use] [View] │ │ [Use] [View] │ │ [Use] [View] ││
│  └──────────────┘ └──────────────┘ └──────────────┘│
│                                                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐│
│  │ 📊 Stats     │ │ 🤝 Camp      │ │ ✍️ Custom     ││
│  │ Update       │ │ Follow-Up    │ │ Blank        ││
│  │ 2 emails     │ │ 3 emails     │ │              ││
│  │ [Use] [View] │ │ [Use] [View] │ │ [Create]     ││
│  └──────────────┘ └──────────────┘ └──────────────┘│
└─────────────────────────────────────────────────────┘
```

### Template Categories (Mapped to Pipeline Stages)

| Category | Pipeline Stage | Purpose |
|---|---|---|
| **Cold Introduction** | Intro | First contact. Who I am, why this school, key stats |
| **Highlight Share** | Intro → Interest | Share new film, updated stats |
| **Interest Builder** | Interest | Deeper engagement, academic fit, program interest |
| **Camp/Event Follow-Up** | Interest | Post-camp or post-showcase follow-up |
| **Visit Request** | Interest → Visit | Express interest in official/unofficial visit |
| **Post-Visit Thank You** | Visit | After campus visit follow-up |
| **Stats/Season Update** | Any | Share updated season stats, awards |
| **Commitment Interest** | Visit → Offer | Signal serious interest, discuss next steps |

### A/B Testing UI (Phase 2)

Instantly supports **variants per step** in a sequence. UI approach:

```
┌─────────────────────────────────────────────┐
│  📧 Step 1: Introduction    [+ Add Variant] │
│                                             │
│  ┌─ Variant A (50%) ─────────────────────┐  │
│  │ Subject: "Class of 2027 OLB —..."     │  │
│  │ [Edit]                                │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌─ Variant B (50%) ─────────────────────┐  │
│  │ Subject: "Interested in playing at..." │  │
│  │ [Edit]                                │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  Split: [50/50 ▾]  Auto-select winner: [On] │
└─────────────────────────────────────────────┘
```

Map to Instantly's `auto_variant_select` field for automatic winner selection.

### Template Editor

**Do NOT build a drag-and-drop HTML email editor.** Recruiting emails to coaches should be **plain text or minimal HTML** — they need to look personal, not like marketing blasts. Coaches get hundreds of emails; formatted newsletters get ignored.

**Editor features:**
- Rich text basics: bold, italic, bullet lists, links
- Merge tag dropdown button (inserts `{{variable}}`)
- "Preview as Coach" mode — shows merged version with sample coach data
- Character/word count
- Mobile preview toggle
- Attach highlight video as link (not attachment)
- Signature block editor (auto-appended)

---

## 6. Analytics Dashboard

### Campaign Overview Dashboard

```
┌─────────────────────────────────────────────────────────┐
│  📊 Campaign: "D1 Schools — Southeast Conference"       │
│  Status: 🟢 Active  |  Started: Jan 15  |  45 coaches  │
│                                                         │
│  ┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐           │
│  │  78%  │  │  12%  │  │  2%   │  │  0%   │           │
│  │ Opens │  │Replies│  │Bounce │  │Unsub  │           │
│  └───────┘  └───────┘  └───────┘  └───────┘           │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  📈 Engagement Over Time                        │   │
│  │  [Line chart: opens, replies by day]            │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  📊 Step Performance                            │   │
│  │  Step 1: 78% open / 8% reply                   │   │
│  │  Step 2: 65% open / 4% reply                   │   │
│  │  Step 3: 52% open / 3% reply                   │   │
│  │  Step 4: 41% open / 1% reply                   │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Per-Coach Engagement View

This is **our differentiator** — Instantly doesn't provide this natively. We build it by combining lead status data with email history.

```
┌─────────────────────────────────────────────────────────┐
│  🏈 Coach Mike Johnson — University of Georgia          │
│  Pipeline Stage: [Interest ●●○○]                       │
│                                                         │
│  Timeline:                                              │
│  ├── Jan 15: 📧 Intro email sent                       │
│  ├── Jan 15: 👁️ Opened (2x)                            │
│  ├── Jan 18: 📧 Follow-up #1 sent                      │
│  ├── Jan 18: 👁️ Opened                                 │
│  ├── Jan 19: 💬 REPLIED: "Send me your junior film"    │
│  ├── Jan 19: ⬆️ Moved to Interest stage                │
│  ├── Jan 20: 📧 You replied with highlight link        │
│  └── Jan 25: 👁️ Opened your reply (3x)                │
│                                                         │
│  [📧 Send Manual Email] [📞 Log Call] [📝 Add Note]    │
└─────────────────────────────────────────────────────────┘
```

### Pipeline Progression Dashboard

The **unique recruiting-specific view** — visualizes how many coaches are at each pipeline stage:

```
┌─────────────────────────────────────────────────────────┐
│  🏈 Your Recruiting Pipeline                            │
│                                                         │
│  Introduction    ████████████████████████  120 coaches  │
│  Interest        ████████████              45 coaches   │
│  Visit Planned   ████████                  12 coaches   │
│  Visit Complete  ████                       5 coaches   │
│  Offer           ██                         2 coaches   │
│                                                         │
│  Conversion: Intro→Interest: 37.5%                      │
│  Avg days to first reply: 4.2 days                      │
└─────────────────────────────────────────────────────────┘
```

### Data Sources for Analytics

| Metric | Source | Sync Method |
|---|---|---|
| Open rate | Instantly `open_tracking` | Webhook `email_opened` + polling |
| Reply rate | Instantly lead interest status | Webhook `lead_replied` + polling |
| Bounce rate | Instantly analytics API | Periodic poll `/api/v2/analytics` |
| Link clicks | Instantly `link_tracking` | Webhook + polling |
| Pipeline stage | Our database | Updated on reply/manual move |
| Per-coach timeline | Instantly Email API + our events | Combined view |

---

## 7. Contact / List Management

### Coach Database UI

```
┌─────────────────────────────────────────────────────────┐
│  🏈 Coach Database                    [+ Add Coach]     │
│                                                         │
│  Filters:                                               │
│  [Division ▾] [Conference ▾] [State ▾] [Position ▾]   │
│  [School Size ▾] [Has Email ▾] [Pipeline Stage ▾]     │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ ☐ Coach Mike Johnson    | DC   | U of Georgia   │   │
│  │   SEC | D1 | mike.j@uga.edu | Stage: Interest  │   │
│  │ ☐ Coach Sarah Williams  | HC   | Baylor         │   │
│  │   Big 12 | D1 | s.williams@... | Stage: Intro  │   │
│  │ ☐ Coach David Lee       | LB   | Furman         │   │
│  │   SoCon | FCS | d.lee@... | Stage: New         │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Selected: 3  [Add to Campaign] [Add to List] [Export] │
└─────────────────────────────────────────────────────────┘
```

### Segmentation & Smart Lists

Pre-built smart filters for recruiting:

| Smart List | Filter Criteria |
|---|---|
| "My D1 Targets" | Division = D1, has email |
| "Southeast Schools" | Conference in SEC/ACC/Sun Belt + State filter |
| "Coaches Who Opened" | Campaign engagement > 0 opens |
| "Replied — Need Follow-Up" | Replied but no response in 5+ days |
| "No Contact Yet" | Pipeline stage = New, no campaigns |
| "Schools Near Me" | State-based proximity |

### Import/Sync Options

**MVP:**
- Manual add (form)
- CSV upload with column mapping
- Pre-built coach database (our curated data — **key value prop**)

**Phase 2:**
- Sync from school athletic websites
- Integration with recruiting services (Hudl, NCSA data if available)
- Bulk email verification via Instantly API before campaign launch

### Mapping to Instantly Leads

When a coach is added to a campaign:
1. Create/update lead in Instantly via `/api/v2/leads` with custom variables (school, conference, division, etc.)
2. Add to appropriate Instantly Lead List
3. Apply Lead Labels matching pipeline stage
4. Sync back engagement data via webhooks

---

## 8. Recruiting-Specific Email Templates

Based on research from NCSA, SportsRecruits, and recruiting best practices:

### Template 1: Cold Introduction (4-step sequence)

**Step 1 — Initial Outreach (Day 0)**
```
Subject: Class of {{grad_year}} {{position}} — {{city_state}}

Coach {{coach_last_name}},

My name is {{athlete_name}}, and I'm a {{grad_year}} {{position}} at 
{{school_name_hs}} in {{city_state}}. I'm reaching out because 
{{school_name}} is a top choice for me both academically and athletically.

Here are my key stats:
• Height/Weight: {{height_weight}}
• 40-yard dash: {{40_time}}
• GPA: {{gpa}}
• [Position-specific stat]: {{custom_stat}}

I'd love the opportunity to learn more about your program. Here's a link 
to my highlight film: {{highlight_link}}

Thank you for your time, Coach.

{{athlete_name}}
{{phone_number}}
```

**Step 2 — Follow-Up (Day 3)**
```
Subject: Re: Class of {{grad_year}} {{position}} — {{city_state}}

Coach {{coach_last_name}},

I wanted to follow up on my previous email. I'm very interested in 
{{school_name}} and would love to discuss how I could contribute to 
your program.

I've attached an updated highlight reel: {{highlight_link}}

Would you have a few minutes to connect this week?

{{athlete_name}}
```

**Step 3 — Value Add (Day 8)**
```
Subject: Season update — {{athlete_name}}, {{position}}

Coach {{coach_last_name}},

Quick update on my season — [recent accomplishment placeholder]. 

I continue to be very interested in {{school_name}} and your program. 
I've also completed your recruiting questionnaire online.

Updated film: {{highlight_link}}

{{athlete_name}}
```

**Step 4 — Soft Close (Day 18)**
```
Subject: Still interested in {{school_name}}

Coach {{coach_last_name}},

I know you're busy with the season, so I'll keep this brief. I remain 
very interested in {{school_name}} and would welcome any opportunity 
to visit campus or speak with you.

Is there a good time to connect, or any upcoming camps/events you'd 
recommend I attend?

Best,
{{athlete_name}}
{{phone_number}}
```

### Template 2: Post-Camp Follow-Up (3 steps)
### Template 3: Visit Request (2 steps)  
### Template 4: Season Stats Update (2 steps)
### Template 5: Post-Visit Thank You (1 step + follow-up)

*(Full content for templates 2-5 would follow the same pattern with appropriate messaging for each stage.)*

---

## 9. Industry Benchmarks & Best Practices

### Competitive Analysis Summary

| Platform | Key Strength to Borrow | Relevance |
|---|---|---|
| **Instantly.ai** | Simple sequence builder, deliverability focus, Unibox | Our backend — leverage API fully |
| **Lemlist** | Step-by-step campaign wizard, personalization images | Wizard flow inspiration |
| **Apollo.io** | Contact database + sequences in one flow | Our coach DB + campaign model |
| **Mailchimp** | Template gallery UX, analytics dashboards | Analytics visualization |
| **HubSpot** | Visual workflow builder, pipeline stages | Phase 2 flowchart builder |
| **Woodpecker** | "If/then" conditional follow-ups, team inbox | Conditional logic patterns |
| **Mixmax** | Gmail-native sequences, scheduling | Real-time engagement notifications |
| **NCSA/SportsRecruits** | Recruiting-specific email guidance | Template content and context |

### Cold Email Best Practices for Recruiting

1. **Plain text emails** — No HTML templates, no images. Look personal.
2. **Short subject lines** — Include position + grad year. Under 50 chars.
3. **Keep it under 150 words** — Coaches scan, they don't read essays.
4. **Include video link, not attachment** — Hudl/YouTube links get opened.
5. **Personalize the "why this school"** — Generic mass emails get ignored.
6. **Send during business hours** — Tue-Thu 8am-11am coach's timezone is optimal.
7. **3-5 touches max** — Don't spam. Quality over quantity.
8. **Stop on reply** — Always. Never send a follow-up after they've responded.

---

## 10. MVP vs Future Phases

### 🚀 MVP (Phase 1) — "Launch & Learn"

| Feature | Scope |
|---|---|
| Campaign wizard | 4-step wizard (goal → coaches → emails → schedule) |
| Sequence builder | Linear step list, max 5 steps |
| Template gallery | 5 pre-built recruiting sequences |
| Merge tags | 12 core recruiting variables |
| Email editor | Simple rich text, merge tag dropdown, preview |
| Analytics | Campaign-level: opens, replies, bounces (cards + numbers) |
| Coach management | Manual add + CSV import + basic filters |
| Pipeline view | Simple bar chart showing coaches per stage |
| Instantly integration | Campaigns, leads, basic analytics sync |

**Estimated build time:** 6-8 weeks for a small team

### 🔧 Phase 2 — "Engagement Intelligence"

| Feature | Scope |
|---|---|
| Visual flowchart builder | Node-based with conditional branching (React Flow) |
| Per-coach timeline | Full engagement history per coach |
| A/B testing | Subject line and body variants with auto-winner |
| Smart lists | Auto-updating lists based on engagement criteria |
| Email verification | Pre-campaign verification via Instantly API |
| Webhook real-time updates | Instant notifications when a coach opens/replies |
| Push notifications | "Coach Johnson at UGA just opened your email!" |
| Pre-built coach database | Curated database of college coaches with verified emails |

### 🌟 Phase 3 — "Recruiting Command Center"

| Feature | Scope |
|---|---|
| AI email writer | Generate personalized emails based on coach/school research |
| Multi-channel sequences | Email + Twitter DM + phone call reminders |
| Team/family collaboration | Parent/advisor can review before sending |
| Recruiting calendar integration | Sync with NCAA recruiting calendar deadlines |
| Coach response sentiment analysis | Auto-categorize replies (positive/neutral/negative) |
| Predictive engagement scoring | Which coaches are most likely to respond |

---

## 11. Technical Architecture Notes

### Data Flow

```
┌──────────────┐     ┌──────────────────┐     ┌───────────────┐
│  GER App UI  │────▶│  GER Backend API │────▶│  Instantly.ai │
│  (React/RN)  │◀────│  (Node/Python)   │◀────│  API V2       │
└──────────────┘     └──────────────────┘     └───────────────┘
                            │    ▲
                            │    │ Webhooks
                            ▼    │
                     ┌──────────────────┐
                     │  GER Database    │
                     │  - Users         │
                     │  - Coaches       │
                     │  - Pipeline      │
                     │  - Templates     │
                     │  - Analytics     │
                     └──────────────────┘
```

### Key Technical Decisions

1. **Our DB is the source of truth for coaches and pipeline** — Instantly is the execution layer only
2. **Sync pattern:** Write-through to Instantly on campaign actions; webhook + periodic poll for reading engagement data back
3. **Template storage:** Our database (not Instantly) — we own the template gallery
4. **Analytics caching:** Poll Instantly analytics every 15 min, cache in our DB, serve from cache
5. **Merge tag resolution:** Resolve on our backend before sending to Instantly (gives us full control)
6. **Multi-tenant:** Each athlete gets their own Instantly workspace or we use lead lists + campaign tagging for isolation

### Instantly API V2 Key Calls (Quick Reference)

```
POST   /api/v2/campaigns              — Create campaign
PATCH  /api/v2/campaigns/{id}         — Update (add sequences, settings)
POST   /api/v2/campaigns/{id}/activate — Launch
POST   /api/v2/campaigns/{id}/pause   — Pause
POST   /api/v2/leads                  — Add coach as lead
GET    /api/v2/leads                  — List leads
PATCH  /api/v2/leads/{id}/interest    — Update pipeline status
GET    /api/v2/analytics              — Campaign metrics
GET    /api/v2/emails                 — Email history (Unibox)
POST   /api/v2/email-verification     — Verify coach email
GET    /api/v2/lead-lists             — List management
```

### Recommended Tech Stack for UI

| Component | Recommendation |
|---|---|
| Campaign wizard | Multi-step form (React Hook Form + Zod) |
| Email editor | TipTap (lightweight rich text) or Lexical |
| Sequence builder (MVP) | Custom React component with DnD Kit |
| Sequence builder (Phase 2) | React Flow |
| Analytics charts | Recharts or Nivo |
| Coach list/table | TanStack Table |
| Pipeline visualization | Custom SVG or Recharts horizontal bar |
| Mobile | React Native or responsive web-first |

---

## Appendix: NCAA Compliance Notes

⚠️ **Important:** NCAA rules restrict when and how coaches can communicate with recruits based on sport and division. While our app facilitates athlete-TO-coach outreach (which is generally unrestricted), we should:

1. Display NCAA recruiting calendar awareness (contact/dead/quiet periods)
2. Note that athletes can email coaches at any time — coaches may be restricted in responding
3. Include educational content about NCAA recruiting rules
4. Consider D1/D2/D3/NAIA/JUCO differences in recruiting communication rules

This is a **feature differentiator** — helping athletes understand when their emails are most likely to get a response based on the recruiting calendar.

---

*Document prepared for Gridiron Elite Recruiting — Feb 2026*
