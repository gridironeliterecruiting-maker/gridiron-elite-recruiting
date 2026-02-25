// Twitter/X API v2 utility functions for OAuth and DM sending
import crypto from 'crypto'

const TWITTER_API_BASE = 'https://api.twitter.com/2'
const TWITTER_TOKEN_URL = 'https://api.twitter.com/2/oauth2/token'

// Trim env vars — Vercel can store trailing newlines from copy-paste
function getTwitterCredentials() {
  return {
    clientId: (process.env.TWITTER_CLIENT_ID || '').trim(),
    clientSecret: (process.env.TWITTER_CLIENT_SECRET || '').trim(),
  }
}

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
 * Exchange an authorization code for tokens.
 *
 * Per Twitter/X official docs for confidential clients:
 * - Authorization: Basic <base64(client_id:client_secret)> header REQUIRED
 * - Body contains ONLY: code, grant_type, redirect_uri, code_verifier
 * - Do NOT include client_id or client_secret in the body
 *
 * @see https://developer.x.com/en/docs/authentication/oauth-2-0/user-access-token
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
  const { clientId, clientSecret } = getTwitterCredentials()

  console.log('[Twitter] Token exchange starting')
  console.log('[Twitter] clientId length:', clientId.length, 'first 8:', clientId.substring(0, 8))
  console.log('[Twitter] clientSecret length:', clientSecret.length, 'first 4:', clientSecret.substring(0, 4))
  console.log('[Twitter] redirectUri:', redirectUri)
  console.log('[Twitter] code length:', code.length)
  console.log('[Twitter] codeVerifier length:', codeVerifier.length)

  // Confidential client: Basic auth header with base64(client_id:client_secret)
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  console.log('[Twitter] Basic auth header length:', basicAuth.length, 'first 20:', basicAuth.substring(0, 20))

  // Body params per Twitter docs: ONLY code, grant_type, redirect_uri, code_verifier
  const body = new URLSearchParams({
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  })

  const res = await fetch(TWITTER_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`,
    },
    body,
  })

  if (!res.ok) {
    const error = await res.text()
    console.error('[Twitter] Token exchange failed:', res.status, error)
    console.error('[Twitter] Request URL:', TWITTER_TOKEN_URL)
    console.error('[Twitter] Auth header present: true, length:', basicAuth.length)
    throw new Error(`Twitter token exchange failed (${res.status}): ${error}`)
  }

  return res.json()
}

/**
 * Refresh an expired Twitter access token.
 * Confidential client: Basic auth header, body has grant_type + refresh_token only.
 */
export async function refreshTwitterToken(refreshToken: string): Promise<{
  access_token: string
  refresh_token?: string
  expires_in: number
}> {
  const { clientId, clientSecret } = getTwitterCredentials()

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const res = await fetch(TWITTER_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    console.error('[Twitter] Token refresh failed:', res.status, error)
    throw new Error(`Twitter token refresh failed (${res.status}): ${error}`)
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
