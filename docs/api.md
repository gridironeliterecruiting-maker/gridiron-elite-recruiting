# API Routes Reference

---

## Campaign Management

**POST `/api/campaigns/create`**
Body: `{ name, goal, type?, templates[]?, recipients[], scheduledAt?, status?, dmMessageBody? }`
Tables: campaigns, campaign_emails, campaign_recipients

**GET `/api/campaigns/[id]`** — Stats: total/pending/scheduled/sent/replied/bounced/opened/clicked

**PATCH `/api/campaigns/[id]`** — Body: `{ status: 'paused' | 'cancelled' | 'active' }`
Pausing resets scheduled → pending. Cancelling clears pending/scheduled.

**POST `/api/campaigns/[id]/launch`**
Safety checks: `can_send_emails` + valid gmail_tokens + campaign is draft/paused.
Calculates send schedule by Gmail tier. Triggers queue if launch time is now.

**GET `/api/campaigns/[id]/details`** — Full analytics, programsWithRecipients grouped by program

---

## DM Campaigns

**GET `/api/dm-campaigns/[id]/details`** — Recipients with twitter_handle, profile for merge tags, stats

**POST `/api/dm-campaigns/[id]/mark-sent`** — Body: `{ recipientId, sent: boolean }`
Side effects: creates pipeline entry if none, logs interaction, auto-completes campaign when all sent.

**POST `/api/dm-campaigns/[id]/send-dm`** — Body: `{ recipientId }`
Resolves merge tags, looks up Twitter user ID, sends via API. Caches user ID in campaign_recipients.

---

## Coach Search

**GET `/api/coaches/search`** — Query: `q`, `division`, `offset`, `limit`. Filters `is_active=true`.

**GET `/api/programs/[id]/coaches`** — All active coaches for a program

---

## Email Processing (Cron — requires CRON_SECRET header)

**GET `/api/email/process-queue`**
1. Kill switch check
2. `can_send_emails` check
3. Allowlist check
4. Fetch scheduled recipients (next_send_at ≤ now, max 50)
5. Check unsubscribes
6. Resolve merge tags
7. Send via Gmail API (MIME multipart)
8. Add tracking pixel + click tracking + unsubscribe footer
9. Log to email_send_log + email_events
10. Schedule next step or mark complete

**GET `/api/email/check-replies`**
Searches Gmail for messages from coach emails (newer_than:2d). Updates status to "replied". 200ms delay per coach.

---

## Gmail OAuth & Tokens

**GET `/api/gmail/authorize`** — Scopes: gmail.send, gmail.readonly, userinfo.email
**GET `/api/gmail/oauth-callback`** — Exchanges code, determines tier by account age, upserts gmail_tokens
**GET `/api/gmail/status`**
**GET `/api/gmail/refresh`** / **`/force-refresh`**
**POST `/api/gmail/check-all-tokens`** — Admin: refresh all user tokens
**POST `/api/gmail/cron-refresh`** — Batch refresh expiring tokens

---

## Twitter/X OAuth

**GET `/api/twitter/authorize`** — PKCE flow. Scopes: dm.read dm.write tweet.read users.read offline.access. Stores code_verifier in HttpOnly cookie.
**GET `/api/twitter/oauth-callback`** — Exchanges code+verifier, upserts twitter_tokens
**GET `/api/twitter/status`**
**POST `/api/twitter/refresh`**

---

## Email Tracking

**GET `/api/track/open`** — 1x1 GIF pixel. Query: `rid`, `cid`
**GET `/api/track/click`** — 302 redirect. Query: `rid`, `cid`, `url`

---

## Templates

**GET `/api/templates`** — System + user's custom templates
**POST `/api/templates`** — Create custom
**PUT `/api/templates/[id]`** — Update own non-system
**DELETE `/api/templates/[id]`** — Delete own non-system

---

## Auth

**POST `/api/auth/register`** — Server-side user creation (skips email confirmation)

---

## Subscription / Stripe (Staging)

**POST `/api/stripe/create-checkout`** — Creates Stripe Checkout session
**POST `/api/stripe/webhook`** — Handles payment events, updates subscriptions table

---

## Admin

**POST `/api/admin/enable-email`** — Toggle kill switch
**GET `/api/debug/session`** — Debug auth session

---

## Other

**GET `/api/unsubscribe`** — Coach opt-out HTML page, updates unsubscribes table
**GET `/api/espn/team`** — Fetches team colors, record, news, links by ESPN team ID
**GET `/api/admin/promo-codes`** — Promo code management
