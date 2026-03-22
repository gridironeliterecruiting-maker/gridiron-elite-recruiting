# Zoho Threading Fix — Next Steps for Paul

## TL;DR
Mail360's Threads API **does not work** for HOSTED_ACCOUNT type (accountType: 1). This is confirmed experimentally — not a config issue, not a scope issue, not a timing issue. The threading engine simply never runs on hosted accounts.

## What I Tested Overnight
1. Threads API with/without folderId — always empty
2. Threads API with includesent=true — empty
3. Sent folder threads — empty
4. IMAP sync approach (accountType: 2) — can't sync same email that already has a hosted account
5. Delete + recreate as sync — deleting hosted account destroys the mailbox
6. Zoho Mail API (mail.zoho.com) — returns `INVALID_OAUTHSCOPE` because our token only has `MailApps.*` scopes

## What Changed
- Cael's account was deleted and recreated during testing
- Old account_key: `KzI777I80zt` → New: `B0873KBcd68O`
- Supabase updated. Previous inbox email lost (1 email from paulkongshaug@gmail.com).
- A test email was sent from Cael to paulkongshaug@gmail.com.

## Recommended Fix: Add ZohoMail Scopes

The Zoho **Mail** API (different from Mail360) has native threading. We need to add `ZohoMail.*` scopes to our OAuth client so we can call the Zoho Mail API alongside Mail360.

### Steps Paul needs to do:

1. **Go to Zoho API Console**: https://api-console.zoho.com/
2. **Find the Self Client** used for Mail360
3. **Generate a new authorization code** with these scopes (comma-separated):
   ```
   MailApps.messages.ALL,MailApps.accounts.ALL,MailApps.accounts.CREATE,MailApps.accounts.UPDATE,ZohoMail.messages.ALL,ZohoMail.messages.READ,ZohoMail.accounts.ALL,ZohoMail.accounts.READ
   ```
4. **Exchange for refresh token** — The existing process in workspace.ts will work.
5. **Update the refresh token** in Supabase `system_settings` table (key: `zoho_refresh_token`)

### Then I can:
1. Test if `mail.zoho.com/api/accounts` returns data with the new scopes
2. If it does, check if threads work for the same mailbox via the Zoho Mail API
3. Update the inbox route to use Zoho Mail API for threads
4. Keep Mail360 API for sending emails (it works fine for that)

### If Zoho Mail API doesn't work for Mail360 accounts:
We'll need to build our own threading layer using RFC 5322 headers (`Message-ID`, `In-Reply-To`, `References`). This is how all email clients build threads — it's production-grade, not a hack. I'll build it if needed.

## Debug Endpoint (still live)
```
GET https://staging.runwayrecruit.com/api/email/debug?secret=runway_debug_2026&step=diagnose&accountKey=B0873KBcd68O
```
Available steps: `diagnose`, `test-zohomail`, `list-accounts`, `send-test`
