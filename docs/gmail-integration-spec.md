# Gmail API Integration — Technical Specification

**App:** Gridiron Elite Recruiting  
**Stack:** Next.js (Vercel) + Supabase (Auth + PostgreSQL) + Tailwind  
**Domain:** gridironeliterecruiting.com  
**Date:** 2026-02-14  
**Status:** Approved for implementation

---

## Table of Contents

1. [Authentication Flow](#1-authentication-flow)
2. [Email Sending Engine](#2-email-sending-engine)
3. [Sequence Scheduler](#3-sequence-scheduler)
4. [Tracking & Analytics](#4-tracking--analytics)
5. [Database Schema](#5-database-schema)
6. [Dashboard / Outreach Page](#6-dashboard--outreach-page)
7. [Deliverability Best Practices](#7-deliverability-best-practices)
8. [Implementation Phases](#8-implementation-phases)
9. [Risks & Mitigations](#9-risks--mitigations)

---

## 1. Authentication Flow

### 1.1 Overview

We already use Supabase Auth. The change: request additional Google OAuth scopes so we can send email on behalf of the user via Gmail API.

### 1.2 Scopes Required

```
openid
email
profile
https://www.googleapis.com/auth/gmail.send
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/gmail.modify
```

- `gmail.send` — send emails as the user
- `gmail.readonly` — read inbox for reply/bounce detection
- `gmail.modify` — mark messages read, manage labels
- We request all three upfront to avoid re-prompting later

### 1.3 Supabase OAuth Configuration

```typescript
// Sign-in with extended scopes
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    scopes: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify',
    queryParams: {
      access_type: 'offline',   // get refresh_token
      prompt: 'consent',        // force consent to ensure refresh_token
    },
    redirectTo: `${window.location.origin}/auth/callback`,
  },
});
```

### 1.4 Token Storage & Refresh

Supabase Auth stores the `provider_token` (access token) and `provider_refresh_token` in the session. **Problem:** Supabase does not persist the provider refresh token server-side by default — it's only available in the initial OAuth callback.

**Strategy:**

1. On the `/auth/callback` route, extract `provider_token` and `provider_refresh_token` from the session.
2. Encrypt and store both in a `gmail_tokens` table (see schema §5).
3. Use the refresh token to obtain new access tokens server-side when the current one expires (tokens last ~1 hour).
4. Refresh logic lives in an Edge Function helper:

```typescript
// lib/gmail-auth.ts
async function getValidAccessToken(userId: string): Promise<string> {
  const { data: tokenRow } = await supabase
    .from('gmail_tokens')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!tokenRow) throw new Error('Gmail not connected');

  // Check expiry (with 5-min buffer)
  if (tokenRow.expires_at > Date.now() + 300_000) {
    return decrypt(tokenRow.access_token_enc);
  }

  // Refresh
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: decrypt(tokenRow.refresh_token_enc),
      grant_type: 'refresh_token',
    }),
  });

  const tokens = await res.json();
  if (tokens.error) throw new Error(`Token refresh failed: ${tokens.error}`);

  await supabase.from('gmail_tokens').update({
    access_token_enc: encrypt(tokens.access_token),
    expires_at: Date.now() + tokens.expires_in * 1000,
  }).eq('user_id', userId);

  return tokens.access_token;
}
```

**Encryption:** Use AES-256-GCM with a key stored in environment variables (`GMAIL_TOKEN_ENCRYPTION_KEY`). Never store tokens in plaintext.

### 1.5 New Account vs Existing Account

| Scenario | Behavior |
|---|---|
| New sign-up | OAuth includes Gmail scopes → tokens captured on callback |
| Existing user (no Gmail scopes) | Prompt to "Connect Gmail" → re-auth with scopes, `prompt: 'consent'` |
| Token revoked by user in Google settings | Detect 401 from Gmail API → show "Reconnect Gmail" banner |
| Multiple Google accounts | One Gmail connection per user. Show connected email on settings page. |

### 1.6 Auth Callback Route

```typescript
// app/auth/callback/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  const supabase = createServerClient(/* ... */);
  const { data: { session } } = await supabase.auth.exchangeCodeForSession(code!);

  if (session?.provider_token && session?.provider_refresh_token) {
    await supabase.from('gmail_tokens').upsert({
      user_id: session.user.id,
      access_token_enc: encrypt(session.provider_token),
      refresh_token_enc: encrypt(session.provider_refresh_token),
      expires_at: Date.now() + 3600_000, // 1 hour
      gmail_address: session.user.email,
    });
  }

  return NextResponse.redirect(new URL('/dashboard', request.url));
}
```

---

## 2. Email Sending Engine

### 2.1 Gmail API Send

Endpoint: `POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send`

```typescript
// lib/gmail-send.ts
interface SendEmailParams {
  to: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  replyToMessageId?: string; // for threading follow-ups
  threadId?: string;
}

async function sendEmail(userId: string, params: SendEmailParams): Promise<{ messageId: string; threadId: string }> {
  const accessToken = await getValidAccessToken(userId);

  const headers = [
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="boundary"`,
  ];

  if (params.replyToMessageId) {
    headers.push(`In-Reply-To: ${params.replyToMessageId}`);
    headers.push(`References: ${params.replyToMessageId}`);
  }

  const raw = [
    headers.join('\r\n'),
    '',
    '--boundary',
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    params.textBody,
    '--boundary',
    'Content-Type: text/html; charset="UTF-8"',
    '',
    params.htmlBody,
    '--boundary--',
  ].join('\r\n');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      raw: Buffer.from(raw).toString('base64url'),
      threadId: params.threadId,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Gmail send failed: ${err.error?.message}`);
  }

  const result = await res.json();
  return { messageId: result.id, threadId: result.threadId };
}
```

### 2.2 Merge Tag Resolution

Merge tags use `{{tag_name}}` syntax. Resolution happens at send time, not at campaign creation.

**Available Tags:**

| Tag | Source | Example |
|---|---|---|
| `{{coach_first_name}}` | coaches table | "Mike" |
| `{{coach_last_name}}` | coaches table | "Smith" |
| `{{coach_title}}` | coaches table | "Head Coach" |
| `{{school_name}}` | programs table | "Ohio State" |
| `{{position}}` | athlete profile | "Quarterback" |
| `{{grad_year}}` | athlete profile | "2027" |
| `{{gpa}}` | athlete profile | "3.8" |
| `{{height}}` | athlete profile | "6'2\"" |
| `{{weight}}` | athlete profile | "210 lbs" |
| `{{40_time}}` | athlete profile | "4.52" |
| `{{hudl_link}}` | athlete profile | full URL |
| `{{highlight_link}}` | tracked redirect URL | wrapped URL for click tracking |
| `{{athlete_first_name}}` | athlete profile | "James" |
| `{{athlete_last_name}}` | athlete profile | "Johnson" |
| `{{unsubscribe_link}}` | generated | CAN-SPAM link |

```typescript
function resolveMergeTags(template: string, context: MergeContext): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, tag) => {
    return context[tag] ?? match; // leave unresolved tags as-is
  });
}
```

### 2.3 Rate Limiting & Smart Pacing

Gmail daily send limits: ~500/day for regular accounts, ~2000/day for Google Workspace.

#### UX Philosophy: Campaigns, Not Daily Limits

Users don't think in daily limits — they think in campaigns. When a user creates a campaign targeting 200 coaches, we accept the full campaign and automatically pace delivery over multiple days for optimal inbox placement. The user sees:

> *"Your campaign will reach all 200 coaches over the next 5 days. We automatically pace delivery for maximum inbox placement. You'll get notified as coaches open and respond."*

Behind the scenes, we calculate pacing based on account age/history and spread sends across days during optimal business hours.

#### Campaign Size Limits (what the user sees)

| Account Tier | Max Campaign Size | Pacing | Approx. Delivery Time |
|---|---|---|---|
| New account (< 14 days) | 200 coaches | 20-30/day | ~7-10 days |
| Building (14-30 days) | 500 coaches | 50-75/day | ~7-10 days |
| Established (30-60 days) | 750 coaches | 100-150/day | ~5-7 days |
| Veteran (60+ days, good history) | 1,000 coaches | 200-300/day | ~4-5 days |

**Note:** Established Gmail accounts (years of normal use) start at "Veteran" tier immediately — no warmup needed.

#### Internal Daily Limits (what the system enforces)

| Account Tier | Daily Limit | Per-Hour Max |
|---|---|---|
| New (< 14 days) | 30 | 10 |
| Building (14-30 days) | 75 | 20 |
| Established (30-60 days) | 150 | 30 |
| Veteran (60+ days) | 300 | 50 |

These are well below Gmail's hard caps (500/day consumer, 2000/day Workspace) to maintain deliverability.

#### New Account Warmup Guidance

For users who create a new Gmail during registration, we show onboarding guidance:
1. "Use your new email normally for a few days — send messages to friends, subscribe to things you like"
2. "Your first campaign will be paced carefully to build your email reputation"
3. "Within 2-3 weeks, you'll have full sending capacity"

The app detects account age via `gmail_tokens.connected_at` and automatically assigns the appropriate tier. Users never see "limits" — they see delivery timelines.

**Implementation:**

- `gmail_tokens.connected_at` tracks account connection date
- `gmail_tokens.account_tier` — computed from account age + sending history + bounce rate
- `email_send_log` table tracks daily/hourly counts
- Before each send, check: `SELECT count(*) FROM email_send_log WHERE user_id = $1 AND sent_at > now() - interval '1 day'`
- If at limit, defer to next available slot
- Spread sends randomly within the hour (jitter of 30–120 seconds between emails)
- Tier auto-upgrades as account ages (checked daily)

### 2.4 Queue System Architecture

```
Campaign Launch → Insert campaign_recipients rows (status: 'pending')
                         ↓
              Supabase Cron (every 5 min)
                         ↓
              Edge Function: process-email-queue
                         ↓
              1. Find pending recipients for active campaigns
              2. Check rate limits for each user
              3. Resolve merge tags
              4. Inject tracking pixel + wrap links
              5. Send via Gmail API
              6. Log to email_send_log + update campaign_recipients
              7. Schedule next step if sequence has more emails
```

**Cron Job (Supabase pg_cron):**

```sql
SELECT cron.schedule(
  'process-email-queue',
  '*/5 * * * *',  -- every 5 minutes
  $$SELECT net.http_post(
    url := 'https://gridironeliterecruiting.com/api/cron/process-queue',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.cron_secret')),
    body := '{}'::jsonb
  )$$
);
```

**Edge Function Logic:**

```typescript
// app/api/cron/process-queue/route.ts
export async function POST(req: Request) {
  // Verify cron secret
  const auth = req.headers.get('Authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) return new Response('Unauthorized', { status: 401 });

  // Find users with pending sends
  const { data: pendingBatch } = await supabase.rpc('get_next_send_batch', { batch_size: 50 });

  for (const item of pendingBatch) {
    try {
      // Check rate limit
      if (await isRateLimited(item.user_id)) continue;

      // Check timezone (only send during business hours in coach's tz)
      if (!isBusinessHours(item.coach_timezone)) continue;

      // Resolve merge tags
      const html = resolveMergeTags(item.html_template, item.merge_context);
      const text = resolveMergeTags(item.text_template, item.merge_context);

      // Inject tracking
      const trackedHtml = injectTrackingPixel(wrapLinksForTracking(html, item.recipient_id), item.recipient_id);

      // Send
      const result = await sendEmail(item.user_id, {
        to: item.coach_email,
        subject: resolveMergeTags(item.subject, item.merge_context),
        htmlBody: trackedHtml,
        textBody: text,
        threadId: item.thread_id,
      });

      // Update status
      await supabase.from('campaign_recipients').update({
        status: 'sent',
        current_step: item.step_number,
        gmail_message_id: result.messageId,
        gmail_thread_id: result.threadId,
        last_sent_at: new Date().toISOString(),
      }).eq('id', item.recipient_id);

      // Log
      await supabase.from('email_send_log').insert({
        user_id: item.user_id,
        campaign_id: item.campaign_id,
        recipient_id: item.recipient_id,
        gmail_message_id: result.messageId,
        sent_at: new Date().toISOString(),
      });

      // Schedule next step
      if (item.next_step_delay_days) {
        await supabase.from('campaign_recipients').update({
          next_send_at: new Date(Date.now() + item.next_step_delay_days * 86400_000).toISOString(),
          status: 'waiting',
        }).eq('id', item.recipient_id);
      } else {
        await supabase.from('campaign_recipients').update({
          status: 'completed',
        }).eq('id', item.recipient_id);
      }
    } catch (err) {
      await supabase.from('campaign_recipients').update({
        status: 'error',
        error_message: err.message,
      }).eq('id', item.recipient_id);
    }
  }

  return new Response('OK');
}
```

---

## 3. Sequence Scheduler

### 3.1 Campaign Structure

A **campaign** has multiple **steps** (emails in sequence). Each step has a delay (days after the previous step). Each **recipient** progresses through the steps independently.

```
Campaign: "D1 QB Outreach - Spring 2026"
  ├── Step 1: Initial intro email (send immediately)
  ├── Step 2: Follow-up with highlights (delay: 3 days)
  ├── Step 3: Check-in + camp invite (delay: 5 days)
  └── Step 4: Final follow-up (delay: 7 days)
```

### 3.2 Follow-Up Scheduling

When step N is sent successfully:

1. Look up step N+1 in `campaign_emails`
2. Calculate `next_send_at = now() + step.delay_days * 86400`
3. Update `campaign_recipients.next_send_at` and set `status = 'waiting'`
4. The cron job picks it up when `next_send_at <= now()`

### 3.3 Conditional Logic

Before sending any step, the queue processor checks:

```typescript
async function shouldSendStep(recipient: CampaignRecipient, campaign: Campaign): Promise<boolean> {
  // Stop on reply
  if (campaign.stop_on_reply && recipient.has_replied) return false;

  // Stop on bounce
  if (recipient.has_bounced) return false;

  // Skip if opened (optional per-campaign setting, rarely used)
  if (campaign.skip_if_opened && recipient.has_opened) return false;

  // Campaign paused or cancelled
  if (campaign.status !== 'active') return false;

  // Manual exclusion
  if (recipient.status === 'excluded') return false;

  return true;
}
```

### 3.4 Timezone-Aware Sending

Coaches receive email during their business hours (9 AM – 5 PM in their timezone, weekdays only).

- `coaches` table has a `timezone` column (e.g., `America/New_York`), inferred from school location
- The queue processor converts the coach's current local time before sending
- If outside business hours, skip and try again next cron cycle

```typescript
function isBusinessHours(timezone: string): boolean {
  const now = new Date();
  const localTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
  const hour = localTime.getHours();
  const day = localTime.getDay();

  // Monday-Friday, 9 AM to 5 PM
  return day >= 1 && day <= 5 && hour >= 9 && hour < 17;
}
```

**Tuesday–Thursday bias:** Optionally weight sends toward Tue/Wed/Thu when engagement is historically higher. Implement as a per-campaign toggle.

---

## 4. Tracking & Analytics

### 4.1 Open Tracking (Tracking Pixel)

Inject a 1×1 transparent pixel at the end of each HTML email body:

```html
<img src="https://gridironeliterecruiting.com/api/track/open/{{recipient_id}}" width="1" height="1" style="display:block" alt="" />
```

**Endpoint:**

```typescript
// app/api/track/open/[recipientId]/route.ts
export async function GET(req: Request, { params }: { params: { recipientId: string } }) {
  const recipientId = params.recipientId;

  // Fire-and-forget: log the open event
  await supabase.from('email_events').insert({
    recipient_id: recipientId,
    event_type: 'open',
    ip_address: req.headers.get('x-forwarded-for'),
    user_agent: req.headers.get('user-agent'),
    created_at: new Date().toISOString(),
  });

  // Update recipient
  await supabase.from('campaign_recipients').update({
    has_opened: true,
    first_opened_at: new Date().toISOString(), // only set if null via SQL
  }).eq('id', recipientId).is('first_opened_at', null);

  // Return 1x1 transparent GIF
  const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  return new Response(pixel, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
```

**Note:** Open tracking is unreliable (Apple MPP, image blocking). Use as directional signal, not ground truth.

### 4.2 Click Tracking

Wrap all links in the email body with a redirect through our domain:

```
Original:  https://www.hudl.com/video/abc123
Tracked:   https://gridironeliterecruiting.com/api/track/click?r={{recipient_id}}&url={{encoded_original_url}}
```

```typescript
function wrapLinksForTracking(html: string, recipientId: string): string {
  return html.replace(/href="(https?:\/\/[^"]+)"/g, (match, url) => {
    // Don't wrap unsubscribe links
    if (url.includes('/unsubscribe')) return match;
    const tracked = `https://gridironeliterecruiting.com/api/track/click?r=${recipientId}&url=${encodeURIComponent(url)}`;
    return `href="${tracked}"`;
  });
}
```

**Click endpoint:**

```typescript
// app/api/track/click/route.ts
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const recipientId = searchParams.get('r');
  const url = searchParams.get('url');

  if (!recipientId || !url) return new Response('Bad request', { status: 400 });

  // Log click event
  await supabase.from('email_events').insert({
    recipient_id: recipientId,
    event_type: 'click',
    metadata: { url },
    created_at: new Date().toISOString(),
  });

  // Update recipient
  await supabase.from('campaign_recipients').update({
    has_clicked: true,
  }).eq('id', recipientId);

  return NextResponse.redirect(url);
}
```

### 4.3 Reply Detection

**Approach: Gmail API polling** (simpler than Pub/Sub for our scale).

A cron job runs every 15 minutes and checks each user's inbox for replies to campaign threads:

```typescript
// app/api/cron/check-replies/route.ts
async function checkRepliesForUser(userId: string) {
  const accessToken = await getValidAccessToken(userId);

  // Get active campaign thread IDs for this user
  const { data: activeRecipients } = await supabase
    .from('campaign_recipients')
    .select('id, gmail_thread_id, campaign_id, coach_id')
    .eq('user_id', userId)
    .not('gmail_thread_id', 'is', null)
    .eq('has_replied', false)
    .in('status', ['sent', 'waiting']);

  if (!activeRecipients?.length) return;

  for (const recipient of activeRecipients) {
    // Check thread for new messages
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${recipient.gmail_thread_id}?format=metadata`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const thread = await res.json();
    const replyMessages = thread.messages?.filter(
      (m: any) => !m.labelIds?.includes('SENT') // messages not sent by us
    );

    if (replyMessages?.length > 0) {
      // Mark as replied
      await supabase.from('campaign_recipients').update({
        has_replied: true,
        replied_at: new Date().toISOString(),
        status: 'replied',
      }).eq('id', recipient.id);

      // Log event
      await supabase.from('email_events').insert({
        recipient_id: recipient.id,
        event_type: 'reply',
        metadata: { gmail_message_id: replyMessages[0].id },
        created_at: new Date().toISOString(),
      });

      // AUTO-PIPELINE: Add coach to pipeline
      await supabase.from('pipeline_entries').upsert({
        user_id: userId,
        coach_id: recipient.coach_id,
        stage: 'replied',
        source: 'email_campaign',
        campaign_id: recipient.campaign_id,
        created_at: new Date().toISOString(),
      }, { onConflict: 'user_id,coach_id' });

      // Create notification
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'coach_replied',
        title: 'Coach replied!',
        body: `A coach replied to your "${recipient.campaign_name}" campaign`,
        metadata: { coach_id: recipient.coach_id, campaign_id: recipient.campaign_id },
      });
    }
  }
}
```

**Cron schedule:**

```sql
SELECT cron.schedule('check-replies', '*/15 * * * *', $$ ... $$);
```

### 4.4 Bounce Detection

Check for bounced messages by looking for bounce-back emails in the user's inbox:

- Query Gmail API: `q=from:mailer-daemon subject:delivery`
- Match bounced addresses against campaign recipients
- Mark as `has_bounced = true`, set `status = 'bounced'`
- Run alongside reply detection cron

### 4.5 Metrics

All computed from `email_events` and `campaign_recipients` tables:

| Metric | Calculation |
|---|---|
| Open rate | `has_opened / total_sent` per campaign |
| Reply rate | `has_replied / total_sent` |
| Click rate | `has_clicked / total_sent` |
| Bounce rate | `has_bounced / total_sent` |
| Sequence completion | Recipients who received all steps / total |
| Response time | `replied_at - last_sent_at` (avg) |
| Best send times | Group opens/replies by hour-of-day, day-of-week |
| Per-template performance | Aggregate metrics per `campaign_emails.id` |
| A/B test results | Compare variant A vs B on open/reply rate with confidence interval |

**Materialized view for dashboard performance:**

```sql
CREATE MATERIALIZED VIEW campaign_stats AS
SELECT
  c.id AS campaign_id,
  c.user_id,
  count(cr.id) AS total_recipients,
  count(cr.id) FILTER (WHERE cr.status = 'sent' OR cr.status IN ('waiting','completed','replied')) AS total_sent,
  count(cr.id) FILTER (WHERE cr.has_opened) AS total_opened,
  count(cr.id) FILTER (WHERE cr.has_replied) AS total_replied,
  count(cr.id) FILTER (WHERE cr.has_clicked) AS total_clicked,
  count(cr.id) FILTER (WHERE cr.has_bounced) AS total_bounced,
  count(cr.id) FILTER (WHERE cr.status = 'completed') AS total_completed
FROM campaigns c
LEFT JOIN campaign_recipients cr ON cr.campaign_id = c.id
GROUP BY c.id, c.user_id;

-- Refresh periodically
SELECT cron.schedule('refresh-campaign-stats', '*/30 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY campaign_stats$$);
```

---

## 5. Database Schema

### 5.1 New Tables

```sql
-- ============================================================
-- Gmail token storage (encrypted)
-- ============================================================
CREATE TABLE gmail_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gmail_address TEXT NOT NULL,
  access_token_enc TEXT NOT NULL,      -- AES-256-GCM encrypted
  refresh_token_enc TEXT NOT NULL,     -- AES-256-GCM encrypted
  expires_at BIGINT NOT NULL,          -- Unix ms
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_valid BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- ============================================================
-- Campaigns
-- ============================================================
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  goal TEXT,                            -- from wizard step 1
  status TEXT NOT NULL DEFAULT 'draft', -- draft, active, paused, completed, cancelled
  stop_on_reply BOOLEAN NOT NULL DEFAULT true,
  skip_if_opened BOOLEAN NOT NULL DEFAULT false,
  send_on_weekdays_only BOOLEAN NOT NULL DEFAULT true,
  send_hour_start INT NOT NULL DEFAULT 9,   -- local to coach timezone
  send_hour_end INT NOT NULL DEFAULT 17,
  ab_test_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  launched_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_campaigns_user_status ON campaigns(user_id, status);

-- ============================================================
-- Campaign email steps (the sequence)
-- ============================================================
CREATE TABLE campaign_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  step_number INT NOT NULL,
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  text_body TEXT NOT NULL,
  delay_days INT NOT NULL DEFAULT 0,     -- days after previous step (0 for step 1)
  variant TEXT DEFAULT 'A',               -- A/B testing: 'A' or 'B'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, step_number, variant)
);

-- ============================================================
-- Campaign recipients (one row per coach per campaign)
-- ============================================================
CREATE TABLE campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  coach_id UUID NOT NULL REFERENCES coaches(id),
  coach_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
    -- pending, scheduled, sent, waiting, completed, replied, bounced, error, excluded
  current_step INT NOT NULL DEFAULT 0,
  assigned_variant TEXT DEFAULT 'A',
  gmail_message_id TEXT,
  gmail_thread_id TEXT,
  next_send_at TIMESTAMPTZ,
  last_sent_at TIMESTAMPTZ,
  has_opened BOOLEAN NOT NULL DEFAULT false,
  first_opened_at TIMESTAMPTZ,
  has_replied BOOLEAN NOT NULL DEFAULT false,
  replied_at TIMESTAMPTZ,
  has_clicked BOOLEAN NOT NULL DEFAULT false,
  has_bounced BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, coach_id)
);

CREATE INDEX idx_recipients_pending ON campaign_recipients(status, next_send_at)
  WHERE status IN ('pending', 'waiting', 'scheduled');
CREATE INDEX idx_recipients_user ON campaign_recipients(user_id, campaign_id);
CREATE INDEX idx_recipients_thread ON campaign_recipients(gmail_thread_id)
  WHERE gmail_thread_id IS NOT NULL;

-- ============================================================
-- Email events (granular tracking log)
-- ============================================================
CREATE TABLE email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES campaign_recipients(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,  -- 'open', 'click', 'reply', 'bounce', 'send', 'error'
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_recipient ON email_events(recipient_id, event_type);
CREATE INDEX idx_events_created ON email_events(created_at);

-- ============================================================
-- Email send log (for rate limiting)
-- ============================================================
CREATE TABLE email_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  campaign_id UUID REFERENCES campaigns(id),
  recipient_id UUID REFERENCES campaign_recipients(id),
  gmail_message_id TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_send_log_rate ON email_send_log(user_id, sent_at DESC);

-- ============================================================
-- Notifications
-- ============================================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  metadata JSONB DEFAULT '{}',
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, read, created_at DESC);

-- ============================================================
-- Pipeline entries (auto-populated on reply)
-- ============================================================
CREATE TABLE pipeline_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES coaches(id),
  stage TEXT NOT NULL DEFAULT 'replied', -- replied, interested, scheduled_call, offer, committed
  source TEXT DEFAULT 'manual',           -- manual, email_campaign
  campaign_id UUID REFERENCES campaigns(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, coach_id)
);

-- ============================================================
-- Unsubscribes
-- ============================================================
CREATE TABLE unsubscribes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  unsubscribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email, user_id)
);
```

### 5.2 RLS Policies

```sql
-- Users can only see their own data
ALTER TABLE gmail_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY gmail_tokens_user ON gmail_tokens FOR ALL USING (user_id = auth.uid());

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY campaigns_user ON campaigns FOR ALL USING (user_id = auth.uid());

ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY recipients_user ON campaign_recipients FOR ALL USING (user_id = auth.uid());

ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY events_user ON email_events FOR ALL USING (
  recipient_id IN (SELECT id FROM campaign_recipients WHERE user_id = auth.uid())
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_user ON notifications FOR ALL USING (user_id = auth.uid());

ALTER TABLE pipeline_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY pipeline_user ON pipeline_entries FOR ALL USING (user_id = auth.uid());
```

### 5.3 Database Function for Queue Processing

```sql
CREATE OR REPLACE FUNCTION get_next_send_batch(batch_size INT DEFAULT 50)
RETURNS TABLE (
  recipient_id UUID,
  user_id UUID,
  campaign_id UUID,
  coach_id UUID,
  coach_email TEXT,
  coach_timezone TEXT,
  step_number INT,
  subject TEXT,
  html_template TEXT,
  text_template TEXT,
  thread_id TEXT,
  next_step_delay_days INT,
  merge_context JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cr.id AS recipient_id,
    cr.user_id,
    cr.campaign_id,
    cr.coach_id,
    cr.coach_email,
    COALESCE(co.timezone, 'America/New_York') AS coach_timezone,
    cr.current_step + 1 AS step_number,
    ce.subject,
    ce.html_body AS html_template,
    ce.text_body AS text_template,
    cr.gmail_thread_id AS thread_id,
    next_ce.delay_days AS next_step_delay_days,
    jsonb_build_object(
      'coach_first_name', co.first_name,
      'coach_last_name', co.last_name,
      'coach_title', co.title,
      'school_name', p.name,
      'position', pr.position,
      'grad_year', pr.grad_year,
      'gpa', pr.gpa,
      'height', pr.height,
      'weight', pr.weight,
      '40_time', pr.forty_time,
      'hudl_link', pr.hudl_link,
      'athlete_first_name', pr.first_name,
      'athlete_last_name', pr.last_name
    ) AS merge_context
  FROM campaign_recipients cr
  JOIN campaigns c ON c.id = cr.campaign_id
  JOIN campaign_emails ce ON ce.campaign_id = cr.campaign_id
    AND ce.step_number = cr.current_step + 1
    AND (ce.variant = cr.assigned_variant OR ce.variant = 'A')
  JOIN coaches co ON co.id = cr.coach_id
  LEFT JOIN programs p ON p.id = co.program_id
  CROSS JOIN LATERAL (
    SELECT u.raw_user_meta_data AS profile FROM auth.users u WHERE u.id = cr.user_id
  ) user_profile
  LEFT JOIN athlete_profiles pr ON pr.user_id = cr.user_id
  LEFT JOIN campaign_emails next_ce ON next_ce.campaign_id = cr.campaign_id
    AND next_ce.step_number = cr.current_step + 2
    AND next_ce.variant = 'A'
  LEFT JOIN unsubscribes unsub ON unsub.email = cr.coach_email AND unsub.user_id = cr.user_id
  WHERE cr.status IN ('pending', 'waiting')
    AND c.status = 'active'
    AND (cr.next_send_at IS NULL OR cr.next_send_at <= now())
    AND cr.has_bounced = false
    AND (c.stop_on_reply = false OR cr.has_replied = false)
    AND unsub.id IS NULL
  ORDER BY cr.next_send_at NULLS FIRST
  LIMIT batch_size;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 6. Dashboard / Outreach Page

### 6.1 Active Campaigns List

**Route:** `/dashboard/outreach`

Displays all campaigns with summary stats:

| Column | Data |
|---|---|
| Campaign Name | Link to drill-down |
| Status | Active / Paused / Completed / Draft |
| Recipients | 45 coaches |
| Sent | 120 emails |
| Open Rate | 62% |
| Reply Rate | 8% |
| Created | Feb 10, 2026 |
| Actions | Pause / Resume / Duplicate / Delete |

### 6.2 Per-Campaign Drill-Down

**Route:** `/dashboard/outreach/[campaignId]`

**Summary cards:** Total sent, opens, replies, clicks, bounces, completion rate.

**Recipient table:**

| Coach | School | Status | Opens | Replied | Last Activity |
|---|---|---|---|---|---|
| Mike Smith | Ohio State | Waiting (Step 2) | 2 | No | Opened 2h ago |
| Jane Doe | Alabama | Replied ✅ | 3 | Yes | Replied Feb 12 |

**Filters:** By status (all, opened, replied, bounced, pending).

**Timeline view:** Visual sequence showing which step each recipient is on.

### 6.3 Pause / Resume / Duplicate

- **Pause:** Set `campaigns.status = 'paused'`. Queue processor skips paused campaigns.
- **Resume:** Set back to `'active'`. Recipients in `'waiting'` status resume on next cron cycle.
- **Duplicate:** Deep copy campaign + campaign_emails. New campaign starts as `'draft'`. Recipients not copied.
- **Cancel:** Set status to `'cancelled'`. All pending/waiting recipients set to `'excluded'`.

### 6.4 Engagement Notifications

Real-time(ish) notifications when coaches engage:

- **Coach opened your email** — low priority, batched
- **Coach replied!** — high priority, shown immediately
- **Coach clicked your Hudl link** — medium priority

Notification bell in the top nav. Unread count badge. Click to see all notifications.

For real-time: use Supabase Realtime subscription on the `notifications` table:

```typescript
supabase
  .channel('notifications')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'notifications',
    filter: `user_id=eq.${userId}`,
  }, (payload) => {
    showToast(payload.new.title);
    incrementBadge();
  })
  .subscribe();
```

---

## 7. Deliverability Best Practices

### 7.1 Smart Pacing

- Follow tier-based limits from §2.3 strictly
- Random jitter between sends (30–120 seconds)
- Never send more than 5 emails in a single minute
- Prefer morning sends (9–11 AM coach-local) — higher open rates
- Present campaign size to user as delivery timeline, not daily caps
- Auto-upgrade account tier as reputation builds (checked daily)
- Veteran accounts (60+ days established Gmail) skip warmup entirely

### 7.2 Content Guidelines

**Do:**
- Personalize every email (coach name, school, specific program reference)
- Keep emails short (under 200 words for initial outreach)
- Use plain-text-style formatting (minimal HTML, no heavy graphics)
- Include a clear reason for reaching out
- One CTA per email

**Avoid (spam triggers):**
- ALL CAPS in subject lines
- Excessive exclamation marks!!!
- Words: "free", "guaranteed", "act now", "limited time"
- Large images or attachments
- Identical emails to many recipients (always personalize)
- Links to URL shorteners (use full URLs or our own tracking domain)

**Automated content check:** Before campaign launch, scan templates for common spam trigger words and warn the user.

### 7.3 Unsubscribe Handling (CAN-SPAM)

Every email must include an unsubscribe link. While recruiting emails to coaches may arguably be relationship-based, CAN-SPAM compliance protects us and improves deliverability.

**Unsubscribe flow:**
1. Link in email footer: `https://gridironeliterecruiting.com/unsubscribe?r={{recipient_id}}`
2. Landing page confirms unsubscribe with one click (no login required)
3. Insert into `unsubscribes` table
4. Queue processor checks unsubscribes before sending (see §5.3 query)
5. Process within 24 hours (we do it instantly)

```typescript
// app/unsubscribe/page.tsx — simple confirmation page
// app/api/unsubscribe/route.ts — processes the unsubscribe
```

### 7.4 Email Footer Template

```html
<div style="margin-top:32px; padding-top:16px; border-top:1px solid #eee; font-size:12px; color:#999;">
  <p>Sent by {{athlete_first_name}} {{athlete_last_name}} via Gridiron Elite Recruiting</p>
  <p><a href="https://gridironeliterecruiting.com/unsubscribe?r={{recipient_id}}" style="color:#999;">Unsubscribe</a></p>
</div>
```

---

## 8. Implementation Phases

### Phase 1: Core Sending (Weeks 1–2)

**Deliverables:**
- Google OAuth with Gmail scopes in Supabase Auth
- Auth callback route that captures and encrypts tokens
- `gmail_tokens` table + encryption helpers
- Gmail send function (`sendEmail`)
- Merge tag resolution
- Tracking pixel endpoint (open tracking)
- Click tracking redirect endpoint
- Basic `campaigns`, `campaign_emails`, `campaign_recipients` tables
- Single-step campaign send (no sequences yet)
- Wire up the existing wizard UI to create campaigns and send

**Estimate:** 8–10 dev days

### Phase 2: Sequences + Scheduling + Reply Detection (Weeks 3–4)

**Deliverables:**
- Multi-step sequences (campaign_emails with step_number + delay_days)
- Cron-based queue processor (every 5 min)
- Rate limiting with warm-up schedule
- Timezone-aware sending
- Reply detection cron (every 15 min)
- Bounce detection
- Auto-pipeline on reply
- Conditional logic (stop on reply, stop on bounce)
- `email_events` table + event logging
- Unsubscribe flow

**Estimate:** 10–12 dev days

### Phase 3: Analytics Dashboard + A/B Testing (Weeks 5–6)

**Deliverables:**
- Outreach dashboard page (campaign list with stats)
- Campaign drill-down page (recipient table, timeline)
- Materialized view for stats
- Notification system (bell, toast, Supabase Realtime)
- Pause/resume/duplicate campaigns
- A/B variant support (two subject lines or body variants per step)
- A/B results comparison view
- Per-template performance metrics
- Best send time analysis

**Estimate:** 8–10 dev days

### Phase 4: Advanced Features (Weeks 7–8+)

**Deliverables:**
- Video hosting integration (self-hosted highlight clips, not just Hudl links)
- AI-powered subject line suggestions
- AI template optimization based on historical performance
- Smart send time optimization (per-coach, ML-based)
- Campaign templates library (pre-built sequences for common goals)
- Team/multi-user support (if needed)
- Export analytics to CSV/PDF

**Estimate:** 10–14 dev days

### Total Timeline

| Phase | Duration | Cumulative |
|---|---|---|
| Phase 1 | 2 weeks | 2 weeks |
| Phase 2 | 2 weeks | 4 weeks |
| Phase 3 | 2 weeks | 6 weeks |
| Phase 4 | 2–3 weeks | 8–9 weeks |

**MVP (Phase 1 + 2):** 4 weeks to a fully functional email campaign system.

---

## 9. Risks & Mitigations

### 9.1 Gmail Rate Limits

| Limit | Value | Mitigation |
|---|---|---|
| Daily sending (consumer) | ~500/day | Warm-up schedule caps well below this |
| Daily sending (Workspace) | ~2000/day | Same warm-up approach |
| Per-second API calls | 250 quota units/sec | Batch sends with jitter; queue processes max 50/cycle |
| Per-user per-second | ~1 send/sec | Already throttled by jitter |

**If rate limited (429 response):** Back off exponentially. Mark recipient as `'scheduled'` with `next_send_at` = now + 1 hour. Alert user if persistent.

### 9.2 Token Expiry / Revocation

| Scenario | Detection | Response |
|---|---|---|
| Access token expired | 401 from Gmail API | Auto-refresh using refresh token |
| Refresh token revoked | 400 from token endpoint | Set `gmail_tokens.is_valid = false`, notify user to reconnect |
| User revoked via Google settings | 401 + refresh fails | Same as above |
| Google account deleted | 401 + refresh fails | Same as above |

**Monitoring:** Track token refresh failures. If a user's token fails 3+ times, pause their campaigns and send notification.

### 9.3 Google OAuth Consent Screen Verification

**Critical for production.** Unverified apps with sensitive scopes (Gmail) show a scary warning and are limited to 100 users.

**Verification process:**
1. Submit app for Google OAuth verification
2. Requires: privacy policy, terms of service, homepage, authorized domains
3. Review takes 2–6 weeks
4. May require security assessment (CASA) for sensitive scopes
5. **Start this process in Phase 1** — do not wait

**Meanwhile:** Up to 100 test users can be added manually in Google Cloud Console. Sufficient for early beta.

### 9.4 Google API Terms Changes

**Risk:** Google could restrict Gmail API access, change pricing, or require additional verification.

**Mitigations:**
- Abstract the email sending layer behind an interface (`EmailProvider`)
- If Gmail becomes untenable, swap to: SendGrid, Resend, or direct SMTP
- Store all campaign data independently of Gmail (we do — everything is in Supabase)
- The tracking system is entirely ours (not Gmail-dependent)

```typescript
// lib/email-provider.ts
interface EmailProvider {
  send(params: SendEmailParams): Promise<{ messageId: string; threadId: string }>;
  checkReplies(userId: string): Promise<Reply[]>;
}

class GmailProvider implements EmailProvider { /* ... */ }
// Future: class SendGridProvider implements EmailProvider { /* ... */ }
```

### 9.5 Deliverability / Spam

**Risk:** Users send too many generic emails → Gmail flags their account → all emails go to spam.

**Mitigations:**
- Enforced warm-up schedule (cannot bypass)
- Content quality checks before launch
- Mandatory personalization (at least `{{coach_first_name}}` and `{{school_name}}`)
- Monitor bounce rate per user; auto-pause campaigns if bounce rate > 10%
- Guide users with in-app tips and template suggestions

### 9.6 Data Privacy

- Encrypted token storage (AES-256-GCM)
- RLS on all tables
- No storing of email content from coaches' replies (only metadata: replied yes/no, timestamp)
- Unsubscribe honored immediately
- FERPA considerations: athlete data is entered by the athlete themselves, not scraped

---

## Appendix A: Environment Variables

```env
# Google OAuth (already in Supabase dashboard, also needed server-side)
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx

# Token encryption
GMAIL_TOKEN_ENCRYPTION_KEY=xxx  # 32-byte hex string

# Cron authentication
CRON_SECRET=xxx

# Existing
NEXT_PUBLIC_SUPABASE_URL=xxx
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
```

## Appendix B: API Routes Summary

| Route | Method | Purpose |
|---|---|---|
| `/auth/callback` | GET | OAuth callback, capture Gmail tokens |
| `/api/cron/process-queue` | POST | Send queued emails (cron) |
| `/api/cron/check-replies` | POST | Poll for replies (cron) |
| `/api/track/open/[recipientId]` | GET | Tracking pixel |
| `/api/track/click` | GET | Click tracking redirect |
| `/api/unsubscribe` | POST | Process unsubscribe |
| `/api/campaigns` | GET/POST | List/create campaigns |
| `/api/campaigns/[id]` | GET/PATCH/DELETE | Campaign CRUD |
| `/api/campaigns/[id]/launch` | POST | Launch campaign |
| `/api/campaigns/[id]/pause` | POST | Pause campaign |
| `/api/campaigns/[id]/resume` | POST | Resume campaign |
| `/api/campaigns/[id]/duplicate` | POST | Duplicate campaign |
| `/api/campaigns/[id]/recipients` | GET | List recipients with stats |
| `/api/notifications` | GET | List notifications |
| `/api/notifications/[id]/read` | PATCH | Mark notification read |
| `/unsubscribe` | Page | Unsubscribe confirmation page |

---

*This spec is the authoritative build plan for Gmail API integration in Gridiron Elite Recruiting. All implementation should reference this document.*
