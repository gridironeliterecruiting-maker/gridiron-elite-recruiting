# Email Sending Architecture

## How Emails Are Sent

1. **Immediate Processing**: When a user launches a campaign with "Launch Now", the launch endpoint automatically triggers the email queue processor immediately. Users don't have to wait.

2. **Backup Cron**: A daily cron job runs at 9 AM UTC as a backup to catch any missed emails or scheduled campaigns.

3. **Vercel Limitation**: The Hobby plan only allows daily cron jobs. The immediate processing on launch is the primary mechanism for sending emails promptly.

## Processing Flow

1. User launches campaign → `/api/campaigns/[id]/launch`
2. Campaign marked as active
3. Recipients scheduled with `next_send_at` timestamps
4. **Launch endpoint calls `/api/email/process-queue` immediately**
5. Emails sent through Gmail API
6. Daily cron catches any stragglers

## Why This Approach?

- **Instant gratification**: Users see emails go out immediately
- **Cost effective**: Works within Vercel Hobby plan limits
- **Reliable**: Daily cron ensures nothing gets missed
- **Safe**: All 4 safety layers still apply during processing