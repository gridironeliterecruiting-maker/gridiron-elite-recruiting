# Email Campaign Feature — Requirements

## Overview
Campaign creation happens in a full-screen overlay (same pattern as program detail). Launched from a "+ Create Campaign" button on the Outreach page (styled/positioned like "+ Add Program" on Pipeline page). Overlay has email icon + "NEW EMAIL CAMPAIGN" top left.

## Progress Tracker
Linear step indicator at the top: **1 Goal → 2 Target → 3 Build → 4 Launch**
Highlights current step. Users can navigate back via Edit buttons on Step 4.

---

## Step 1 — Goal
Four large vertical rectangular cards to choose from:

1. **Get a Response** — "Initiate contact to GET A RESPONSE"
2. **Evaluate Your Film** — "Get them to EVALUATE YOUR FILM"
3. **Build Interest** — "Share your story to BUILD INTEREST"
4. **Secure a Visit** — "Discuss the details and SECURE A VISIT"

Maps to the recruiting funnel. Goal selection drives template recommendations in Step 3.

---

## Step 2 — Target
**Global coach counter** at top: "Coaches Selected: XX" (live updating)

### Flow: Level → Conference → Programs → Coaches
- **Multi-level allowed** — user can select across FBS, FCS, DII, DIII, JUCO, NAIA
- Division buttons displayed as a row of pills
- Selecting a division shows conferences for that level + "Select All" button
- Selecting a conference expands a program list (one conference expanded at a time)
- Switching to a different conference collapses the current one but retains selections
- Switching to a different division resets the drill-down view but keeps all previously selected coaches
- Programs selectable individually or "Select All"
- **Search box** always visible to the right of the level row — jump to any program or coach by name

### Smart Coach Auto-Selection
For each selected program, automatically pre-select:
- All coaches with "recruiting" in their title (Recruiting Coordinator, Director of Recruiting, etc.)
- The athlete's **position coach** based on their profile position

### Fuzzy Position Matching
Build a position alias map:
- QB → Quarterbacks Coach
- WR → Wide Receivers Coach
- RB → Running Backs Coach
- CB, S → DB / Defensive Backs Coach
- OL, OT, OG, C → Offensive Line Coach
- DL, DE, DT → Defensive Line Coach
- LB → Linebackers Coach
- TE → Tight Ends Coach
- K, P → Special Teams Coach
- etc.

### Coach Customization
Clicking a program in the expanded list opens a right-side overlay (same design as coach overlay on program page):
- Program logo + name top left
- Message: "We recommend that initial emails to a program target recruiting coaches and your position coach."
- Full coach list with checkboxes — pre-selected coaches at top
- User can add/remove coaches

### Goal-Specific Targeting (Goals 2-4)
- Details TBD — likely filter to programs already contacted, in pipeline, etc.

---

## Step 3 — Build
Header: "Build"
Subheader: "Recommended Sequence"

### Email Sequence Cards
- Numbered list of email templates based on selected goal
- Each card shows: number, template name, preview text with ellipsis
- Clicking a card opens right-side overlay:
  - Template name at top
  - Full email in rich text editor (font, formatting, effects)
  - Save button

### Dynamic Variables (Merge Tags)
- Displayed as styled chips/pills: `((Coach Name))`, `((Class of 2026))`, `((School Name))`, etc.
- **Deletable** but **NOT editable** — prevents broken merge tags
- e.g., user can remove `((Coach Name))` but can't type inside it

### Follow-Up Timing
- Each follow-up email shows "after X days" with editable number
- Defaults based on best-practice research (see docs/email-options.md)
- e.g., Follow Up 1 after 3 days, Follow Up 2 after 5 days, etc.

### Sequence Structure (Goal 1 — Cold Intro)
1. **Intro Email** — initial outreach
2. **Follow Up 1** — after X days if no response
3. **Follow Up 2** — after X days
4. (Additional follow-ups as research determines optimal count)

Save button in bottom right → advances to Step 4.

---

## Step 4 — Launch (Review)
- **Campaign Name** field — pre-populated (e.g., "Initial Email 1"), editable
- **Goal recap** in plain language: "The goal of this campaign is to introduce yourself and GET A RESPONSE."
- **Auto-pipeline note**: "Programs that respond are automatically added to your pipeline."
- **Coach count**: "You have targeted 143 coaches" + Edit button → back to Step 2
- **Sequence count**: "You have scheduled 4 sequential emails in this campaign" + Edit button → back to Step 3
- **Schedule button** — opens right-side overlay with:
  - Date/time picker (defaulted to researched optimal send time for coach response rates)
  - "Launch Now" button for immediate send
  - Research needed: optimal day/time for cold emails to college coaches

---

## Automation Rules
- **Program-level response detection**: When ANY coach at a program responds, stop all automated follow-ups for that entire program
- **Auto-pipeline movement**: Responses and key actions automatically move programs into/through pipeline stages
- **Dashboard notifications**: All automated movements trigger notifications displayed on dashboard (Action Items / Recent Progress section)
- **Response guidance**: When a coach responds, advise the user on next steps based on the response content

---

## Design Notes
- Full-screen overlay matches program detail pattern
- Email icon instead of team logo in header
- All UI elements follow existing design system (pills, cards, overlays, fonts, padding)
- Coach selection overlay reuses coach overlay component from program page
- Mobile-friendly — all steps must work on mobile

---

## Tech Stack
- **Email engine**: Instantly.ai API ($30/mo Growth plan)
- **Backend**: Supabase (campaign data, sequence tracking, response detection)
- **Frontend**: Next.js + Tailwind (matching existing design system)
- See docs/email-options.md for Instantly.ai research and capabilities

---

## Open Questions
- [x] Step 4: Schedule overlay with date/time picker + Launch Now option
- [ ] Goal 2-4 targeting details (filter to existing contacts, pipeline programs, etc.)
- [ ] Optimal number of follow-up emails per sequence
- [ ] Optimal follow-up timing (days between emails)
- [ ] Email sending schedule (time of day, days of week)
- [ ] Response detection mechanism (Instantly webhook? polling?)
- [ ] What pipeline stage do auto-added programs go to?
- [ ] Template content for each goal type
