'use strict'

/**
 * check-dm-open.js
 *
 * Uses the Twitter API v2 to check whether each coach's DMs are open.
 * Requires at least one athlete to have connected their X account.
 *
 * The `can_dm` field returns true if the authenticated user (the athlete)
 * can send a DM to that account. This correctly reflects "open to all" vs
 * "verified only" vs "closed" — from the perspective of our users.
 *
 * Results are written to coaches.twitter_dm_open and twitter_dm_checked_at.
 *
 * Usage:
 *   node check-dm-open.js [options]
 *
 * Options:
 *   --force          Re-check all coaches (not just unchecked/stale ones)
 *   --limit=N        Only check N coaches (useful for testing)
 *   --stale-days=N   Re-check coaches last checked more than N days ago (default: 30)
 */

const { Pool } = require('pg')
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
require('dotenv').config({ path: require('path').join(__dirname, '../app/.env.local') })

const TWITTER_API_BASE  = 'https://api.twitter.com/2'
const BATCH_SIZE        = 100    // Twitter allows 100 usernames per request
const REQUEST_DELAY_MS  = 3200   // ~300 requests/15 min → 1 per 3s (with margin)

async function refreshToken(pool, token) {
  const creds = Buffer.from(
    `${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`
  ).toString('base64')

  const res = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/x-www-form-urlencoded',
      'Authorization': `Basic ${creds}`,
    },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: token.refresh_token,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Token refresh failed (${res.status}): ${text}`)
  }

  const data   = await res.json()
  const expiry = new Date(Date.now() + data.expires_in * 1000)

  await pool.query(
    `UPDATE twitter_tokens
     SET access_token = $1, refresh_token = $2, token_expiry = $3
     WHERE id = $4`,
    [data.access_token, data.refresh_token || token.refresh_token, expiry.toISOString(), token.id]
  )

  return data.access_token
}

async function main() {
  const args      = process.argv.slice(2)
  const forceAll  = args.includes('--force')
  const limitArg  = args.find(a => a.startsWith('--limit='))
  const staleArg  = args.find(a => a.startsWith('--stale-days='))
  const limit     = limitArg  ? parseInt(limitArg.split('=')[1])  : 0
  const staleDays = staleArg  ? parseInt(staleArg.split('=')[1])  : 30

  console.log(`\n${'='.repeat(52)}`)
  console.log('  Twitter DM Open Check')
  console.log(`  Scope:      ${forceAll ? 'ALL coaches with handles' : `Unchecked + stale (>${staleDays}d)`}`)
  if (limit) console.log(`  Limit:      ${limit.toLocaleString()} coaches`)
  console.log(`${'='.repeat(52)}\n`)

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  try {
    // ── Get a valid Twitter token ────────────────────────────────────────────
    const { rows: tokens } = await pool.query(
      `SELECT * FROM twitter_tokens ORDER BY connected_at DESC`
    )
    if (tokens.length === 0) {
      throw new Error(
        'No Twitter tokens found. An athlete must connect their X account first.'
      )
    }

    let token = tokens[0]
    if (new Date(token.token_expiry) <= new Date()) {
      console.log('Refreshing expired token...')
      token.access_token = await refreshToken(pool, token)
    }

    // ── Load coaches to check ────────────────────────────────────────────────
    const staleCutoff = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000).toISOString()

    const whereClause = forceAll
      ? `WHERE twitter_handle IS NOT NULL AND twitter_handle != '' AND is_active = true`
      : `WHERE twitter_handle IS NOT NULL AND twitter_handle != '' AND is_active = true
           AND (twitter_dm_checked_at IS NULL OR twitter_dm_checked_at < $1)`

    const limitClause = limit ? `LIMIT ${limit}` : ''

    const queryArgs = forceAll ? [] : [staleCutoff]
    const { rows: coaches } = await pool.query(
      `SELECT id, twitter_handle FROM coaches
       ${whereClause}
       ORDER BY twitter_dm_checked_at ASC NULLS FIRST
       ${limitClause}`,
      queryArgs
    )

    if (coaches.length === 0) {
      console.log('No coaches to check — all are up to date.')
      return
    }

    console.log(`Checking ${coaches.length.toLocaleString()} coaches in batches of ${BATCH_SIZE}...\n`)

    let checked = 0, dmOpen = 0, dmClosed = 0, notFound = 0, errors = 0
    let retryBatch = false

    for (let i = 0; i < coaches.length; i += BATCH_SIZE) {
      if (retryBatch) { i -= BATCH_SIZE; retryBatch = false }

      const batch = coaches.slice(i, i + BATCH_SIZE)

      // Sanitize handles: strip leading @, skip URLs and anything not matching Twitter's format
      const VALID_HANDLE = /^[A-Za-z0-9_]{1,15}$/
      const sanitizedBatch = batch.map(c => {
        let h = (c.twitter_handle || '').trim().replace(/^@/, '')
        // Strip full URLs down to just the handle segment
        const urlMatch = h.match(/(?:twitter\.com|x\.com)\/([A-Za-z0-9_]{1,15})/i)
        if (urlMatch) h = urlMatch[1]
        return { ...c, _handle: VALID_HANDLE.test(h) ? h : null }
      })

      // Mark invalid handles as not-found immediately
      for (const c of sanitizedBatch.filter(c => !c._handle)) {
        notFound++
        await pool.query(
          `UPDATE coaches SET twitter_dm_open = false, twitter_dm_checked_at = NOW() WHERE id = $1`,
          [c.id]
        )
        checked++
      }

      const validBatch = sanitizedBatch.filter(c => c._handle)
      if (validBatch.length === 0) continue

      const usernames = validBatch.map(c => c._handle).join(',')

      try {
        const res = await fetch(
          `${TWITTER_API_BASE}/users/by?usernames=${encodeURIComponent(usernames)}&user.fields=receives_your_dm`,
          { headers: { Authorization: `Bearer ${token.access_token}` } }
        )

        if (res.status === 401) {
          console.log('\nToken expired — refreshing and retrying...')
          token.access_token = await refreshToken(pool, token)
          retryBatch = true
          continue
        }

        if (res.status === 429) {
          console.log('\nRate limited — waiting 60s...')
          await new Promise(r => setTimeout(r, 60_000))
          retryBatch = true
          continue
        }

        if (!res.ok) {
          const errBody = await res.text()
          console.error(`\nAPI error ${res.status} for batch starting at ${i}: ${errBody}`)
          errors += validBatch.length
          await new Promise(r => setTimeout(r, REQUEST_DELAY_MS * 4))
          continue
        }

        const data  = await res.json()
        const users = data.data || []

        // Build handle → receives_your_dm map from response
        const dmMap = new Map()
        for (const u of users) {
          dmMap.set(u.username.toLowerCase(), u.receives_your_dm ?? false)
        }

        // Update each coach in this batch
        for (const coach of validBatch) {
          const handle = coach._handle.toLowerCase()
          const found  = dmMap.has(handle)
          const canDm  = found ? dmMap.get(handle) : false

          // Account not found in response = suspended/deleted/handle changed
          if (!found) notFound++
          else if (canDm) dmOpen++
          else dmClosed++

          await pool.query(
            `UPDATE coaches
             SET twitter_dm_open = $1, twitter_dm_checked_at = NOW()
             WHERE id = $2`,
            [canDm, coach.id]
          )
          checked++
        }

        // Progress line
        const pct = Math.round((checked / coaches.length) * 100)
        process.stdout.write(
          `\r  ${checked.toLocaleString()} / ${coaches.length.toLocaleString()} (${pct}%) ` +
          `| Open: ${dmOpen.toLocaleString()} | Closed: ${dmClosed.toLocaleString()} | Not found: ${notFound.toLocaleString()}`
        )

      } catch (err) {
        console.error(`\nBatch error: ${err.message}`)
        errors += validBatch.length
      }

      // Respect rate limits between batches
      if (i + BATCH_SIZE < coaches.length) {
        await new Promise(r => setTimeout(r, REQUEST_DELAY_MS))
      }
    }

    console.log(`\n\n${'='.repeat(52)}`)
    console.log('  RESULTS')
    console.log(`${'='.repeat(52)}`)
    console.log(`  Coaches checked:    ${checked.toLocaleString()}`)
    console.log(`  DMs open:           ${dmOpen.toLocaleString()}`)
    console.log(`  DMs closed:         ${dmClosed.toLocaleString()}`)
    console.log(`  Handle not found:   ${notFound.toLocaleString()}`)
    if (errors) console.log(`  Errors:             ${errors.toLocaleString()}`)
    console.log()

  } finally {
    await pool.end()
  }
}

main().catch(err => { console.error('\nFatal error:', err.message); process.exit(1) })
