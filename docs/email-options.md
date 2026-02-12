# Email Outreach Options for Gridiron Elite Recruiting

## ⭐ RECOMMENDED: Instantly.ai
**Website:** instantly.ai
**Why it's perfect for us:** Built specifically for cold outreach with automated multi-step sequences — mirrors the recruiting process perfectly.

### How It Maps to Recruiting
The whole recruiting outreach process IS cold outreach:
1. **Initial intro email** → coach doesn't know you
2. **Follow-up if no response** → automated after X days
3. **Different angle email** → mention camp, film update, etc.
4. **Final nudge** → last attempt before moving on

Instantly automates this entire flow with conditional logic:
- If coach **opens but doesn't reply** → send follow-up #2 with different angle
- If coach **replies** → stop sequence, alert athlete
- If coach **doesn't open** → try different subject line
- If coach **bounces** → flag bad email, try alternate contact

### Pricing
| Plan | Price | Emails/month | Warmup | Leads |
|------|-------|-------------|--------|-------|
| Growth | $30/mo | 5,000 | Unlimited | 1,000 |
| Hypergrowth | $77.6/mo | 25,000 | Unlimited | 25,000 |
| Light Speed | $286.3/mo | 500,000 | Unlimited | 100,000 |

### Key Features
- **Email warmup built in** — gradually builds sender reputation so emails don't go to spam
- **Multi-step sequences** — design the full recruiting outreach flow (intro → follow-up → camp interest → film update)
- **A/B testing** — test subject lines to maximize open rates
- **Reply detection** — automatically stops the sequence when a coach responds
- **Analytics** — open rates, reply rates, bounce rates per sequence/template
- **Unified inbox** — see all coach replies in one place
- **Lead management** — tag coaches by division, conference, response status
- **API access** — can integrate with our Next.js/Supabase stack

### Why It Works With Our Stack
- REST API integrates cleanly with Next.js
- We can sync sequence status back to Supabase (pipeline stage updates)
- Webhook support: when a coach replies, trigger a pipeline stage change automatically
- Our Supabase coach database feeds directly into Instantly campaigns
- Can segment sends by division, conference, or pipeline stage

### The Recruiting Sequence (Example)
**"7-Day Introduction Sequence"**
- Day 0: Initial intro email with Hudl link + measurables
- Day 3: Follow-up (if no open) — different subject line, same content
- Day 5: Film highlight follow-up — "Updated highlights from last week's game"
- Day 7: Direct ask — "Would love to attend a camp/visit. Any upcoming opportunities?"

**"Post-Camp Follow-Up"**
- Day 0: Thank you email after camp
- Day 3: Film update with camp performance highlights
- Day 7: Ask about next steps

---

## Alternative: Lemlist
**Website:** lemlist.com
**Price:** $39/mo (Email Starter), $69/mo (Email Pro with warmup)
**Similar to Instantly but:** More focused on personalization (custom images, videos in emails). Slightly more expensive. Good multichannel (email + LinkedIn, but LinkedIn isn't relevant for us).

## Alternative: Woodpecker
**Website:** woodpecker.co  
**Price:** $29/mo for 500 contacts
**Good for:** Smaller scale, simpler interface. Built for B2B cold outreach.
**Limitation:** Smaller sending limits, less automation than Instantly.

## For Reference: Simple Senders (NOT recommended for sequences)

These are good for sending individual emails but DON'T have the automated sequence/drip functionality:

| Service | Price | Best For |
|---------|-------|----------|
| Resend | Free–$20/mo | Transactional emails, notifications |
| SendGrid | Free–$20/mo | Bulk sends, marketing campaigns |
| Amazon SES | ~Free on EC2 | High volume, low cost |
| Postmark | $15/mo | Best deliverability, transactional |

These could handle the actual *sending* but we'd have to build all the sequence logic, warmup, reply detection, and analytics ourselves. Instantly gives us all of that out of the box.

---

## Implementation Plan
1. **Sign up for Instantly Growth plan** ($30/mo)
2. **Set up custom sending domain** (outreach@gridironeliterecruiting.com)
3. **Warm up the domain** (Instantly does this automatically — takes ~2 weeks)
4. **Import coach segments** from our Supabase database
5. **Build recruiting sequences** (templates already in our DB)
6. **Connect via API** — sync replies/opens back to our pipeline
7. **Athlete dashboard** shows sequence status per coach/program

## CAN-SPAM / Best Practices
- Use athlete's real name and school
- Include unsubscribe option
- Real reply-to address
- Personalize with coach name, school name, position
- Don't spam — targeted, relevant outreach only
- Keep volume reasonable (50-100 coaches per sequence, not thousands)
