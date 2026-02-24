// Twitter/X API v2 utility functions for OAuth and DM sending
import crypto from 'crypto'

const TWITTER_API_BASE = 'https://api.twitter.com/2'
const TWITTER_TOKEN_URL = 'https://api.twitter.com/2/oauth2/token'

/**
 * Generate a PKCE code_verifier (43-128 chars, base64url)
 */
export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url')
}

/**
 * Generate a PKCE code_challenge from a verifier (S256)
 */
export function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url')
}

/**
 * Exchange an authorization code for tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<{
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
  scope: string
}> {
  const clientId = process.env.TWITTER_CLIENT_ID || ''
  const clientSecret = process.env.TWITTER_CLIENT_SECRET || ''

  const res = await fetch(TWITTER_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Twitter token exchange failed: ${error}`)
  }

  return res.json()
}

/**
 * Refresh an expired Twitter access token
 */
export async function refreshTwitterToken(refreshToken: string): Promise<{
  access_token: string
  refresh_token?: string
  expires_in: number
}> {
  const clientId = process.env.TWITTER_CLIENT_ID || ''
  const clientSecret = process.env.TWITTER_CLIENT_SECRET || ''

  const res = await fetch(TWITTER_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Twitter token refresh failed: ${error}`)
  }

  return res.json()
}

/**
 * Get the authenticated user's Twitter profile
 */
export async function getTwitterMe(accessToken: string): Promise<{
  id: string
  username: string
  name: string
}> {
  const res = await fetch(`${TWITTER_API_BASE}/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Failed to get Twitter user: ${error}`)
  }

  const data = await res.json()
  return data.data
}

/**
 * Look up a Twitter user ID by username (handle)
 */
export async function getTwitterUserByUsername(
  accessToken: string,
  username: string
): Promise<{ id: string; username: string; name: string } | null> {
  // Strip @ if present
  const handle = username.replace(/^@/, '')

  const res = await fetch(`${TWITTER_API_BASE}/users/by/username/${handle}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    if (res.status === 404) return null
    const error = await res.text()
    throw new Error(`Twitter user lookup failed for @${handle}: ${error}`)
  }

  const data = await res.json()
  return data.data || null
}

/**
 * Send a DM to a user via the Twitter API v2
 * Uses the "create a dm conversation with a participant" endpoint
 */
export async function sendTwitterDm(
  accessToken: string,
  participantId: string,
  text: string
): Promise<{ dm_conversation_id: string; dm_event_id: string }> {
  const res = await fetch(
    `${TWITTER_API_BASE}/dm_conversations/with/${participantId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    }
  )

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Twitter DM send failed: ${error}`)
  }

  const data = await res.json()
  return data.data
}

/**
 * Batch-lookup Twitter user IDs by usernames (up to 100 at a time)
 */
export async function getTwitterUsersByUsernames(
  accessToken: string,
  usernames: string[]
): Promise<Map<string, { id: string; username: string; name: string }>> {
  const results = new Map<string, { id: string; username: string; name: string }>()

  // Twitter allows up to 100 usernames per request
  const batches: string[][] = []
  for (let i = 0; i < usernames.length; i += 100) {
    batches.push(usernames.slice(i, i + 100))
  }

  for (const batch of batches) {
    const cleaned = batch.map(u => u.replace(/^@/, ''))
    const res = await fetch(
      `${TWITTER_API_BASE}/users/by?usernames=${cleaned.join(',')}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    if (!res.ok) {
      console.error('Batch user lookup failed:', await res.text())
      continue
    }

    const data = await res.json()
    for (const user of (data.data || [])) {
      results.set(user.username.toLowerCase(), user)
    }
  }

  return results
}
