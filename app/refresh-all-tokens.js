#!/usr/bin/env node

// Direct script to refresh all Gmail tokens
// Called by cron job to ensure tokens never expire

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres.ufmzldfkdpjeyvjfpoid:MScp1BrdQZF8QBHp@aws-0-us-west-2.pooler.supabase.com:5432/postgres';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '130933663415-j5u1qtr06hnn4rj4porum1g9cq7eae8s.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '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';

async function refreshGmailToken(refreshToken) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to refresh Gmail token: ${error}`);
  }

  return res.json();
}

async function main() {
  const { Client } = require('pg');
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    console.log('[Token Refresh] Connected to database');

    // Get all Gmail tokens
    const result = await client.query(
      'SELECT id, email, refresh_token, token_expiry FROM gmail_tokens WHERE refresh_token IS NOT NULL'
    );

    console.log(`[Token Refresh] Found ${result.rows.length} tokens to check`);

    for (const token of result.rows) {
      const expiry = new Date(token.token_expiry);
      const now = new Date();
      const hoursUntilExpiry = (expiry - now) / (1000 * 60 * 60);

      console.log(`[Token Refresh] ${token.email}: expires in ${hoursUntilExpiry.toFixed(2)} hours`);

      // Refresh if expired or expiring within 10 minutes
      if (hoursUntilExpiry <= 0.17) {
        try {
          console.log(`[Token Refresh] Refreshing token for ${token.email}...`);
          const refreshed = await refreshGmailToken(token.refresh_token);
          const newExpiry = new Date(Date.now() + (refreshed.expires_in || 3600) * 1000);

          await client.query(
            'UPDATE gmail_tokens SET access_token = $1, token_expiry = $2, updated_at = NOW() WHERE id = $3',
            [refreshed.access_token, newExpiry, token.id]
          );

          console.log(`[Token Refresh] Successfully refreshed token for ${token.email}`);
        } catch (error) {
          console.error(`[Token Refresh] Failed to refresh token for ${token.email}:`, error.message);
        }
      }
    }

    console.log('[Token Refresh] Completed');
  } catch (error) {
    console.error('[Token Refresh] Error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch(console.error);