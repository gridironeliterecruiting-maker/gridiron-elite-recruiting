# Testing Email Sending

## ✅ All Safety Checks Enabled

1. **Kill Switch**: `email_sending_enabled = true` ✓
2. **User Permission**: gridironeliterecruiting@gmail.com has `can_send_emails = true` ✓  
3. **Gmail Connected**: gridironeliterecruiting@gmail.com ✓
4. **Recipient Allowlist**: paulkong3@gmail.com (Paul - test account) ✓

## Testing Steps

1. **Create and launch a campaign** targeting yourself at Ohio State
2. **Manually trigger the email queue** (cron only runs once daily at 9 AM UTC):
   ```bash
   curl https://gridironeliterecruiting.com/api/email/process-queue \
     -H "Authorization: Bearer gridiron-cron-secret-2024"
   ```

3. Check your inbox at paulkong3@gmail.com

## Queue Status Check

To see if emails are queued:
```sql
SELECT 
  cr.coach_email,
  cr.status,
  cr.next_send_at,
  c.name as campaign_name
FROM campaign_recipients cr
JOIN campaigns c ON cr.campaign_id = c.id
WHERE cr.coach_email = 'paulkong3@gmail.com'
ORDER BY cr.created_at DESC;
```

## Troubleshooting

If emails don't send:
1. Check campaign status is 'active'
2. Check recipient status is 'scheduled' with next_send_at <= now
3. Check for errors in Vercel logs
4. Verify Gmail tokens haven't expired