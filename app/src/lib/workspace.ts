/**
 * Zoho Mail360 helpers
 * Single app-level access token, per-mailbox account_key routing.
 *
 * RESILIENCE DESIGN:
 * 1. Refresh token stored in Supabase (system_settings.zoho_refresh_token) as
 *    primary source — can be rotated without a Vercel redeploy.
 *    Falls back to ZOHO_REFRESH_TOKEN env var if DB has none.
 * 2. Access token cached in-process (~1 hour). Cache is immediately invalidated
 *    on any MA_9067 (Invalid OAuth Token) error.
 * 3. Every Zoho API call auto-retries once with a fresh token on MA_9067.
 * 4. If access token fetch returns empty/invalid, throws immediately with a
 *    clear message rather than caching a broken token.
 */

import { createAdminClient } from '@/lib/supabase/admin'

const ZOHO_API_BASE = 'https://mail360.zoho.com/api'
const DOMAIN = () => process.env.ZOHO_DOMAIN || 'jetstreammail.com'

function getZohoCredentials() {
  const clientId = process.env.ZOHO_CLIENT_ID
  const clientSecret = process.env.ZOHO_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Zoho Mail360 credentials not configured (ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET)')
  }
  return { clientId, clientSecret }
}

// Process-level token cache (~1 hour validity, resets on cold start)
let _cachedToken: { token: string; expiresAt: number } | null = null

/** Invalidate the cached access token — called on MA_9067 */
function invalidateTokenCache() {
  _cachedToken = null
}

/** Get the refresh token: Supabase first, env var fallback */
async function getRefreshToken(): Promise<string> {
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('system_settings')
      .select('value')
      .eq('key', 'zoho_refresh_token')
      .maybeSingle()
    if (data?.value && data.value.trim()) {
      return data.value.trim()
    }
  } catch {
    // Fall through to env var
  }
  const envToken = process.env.ZOHO_REFRESH_TOKEN
  if (!envToken) {
    throw new Error('No Zoho refresh token found — set ZOHO_REFRESH_TOKEN env var or zoho_refresh_token in system_settings')
  }
  return envToken
}

/** Fetch a fresh access token from Zoho using the refresh token */
async function fetchFreshAccessToken(): Promise<string> {
  const { clientId, clientSecret } = getZohoCredentials()
  const refreshToken = await getRefreshToken()

  const res = await fetch(`${ZOHO_API_BASE}/access-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Zoho access token request failed (${res.status}): ${err}`)
  }

  const data = await res.json()
  const token = data.data?.access_token as string | undefined

  if (!token || typeof token !== 'string' || token.trim() === '') {
    throw new Error(`Zoho returned empty/invalid access token. Response: ${JSON.stringify(data)}`)
  }

  const expiresIn = (data.data?.expires_in as number) || 3600
  _cachedToken = { token, expiresAt: Date.now() + expiresIn * 1000 }
  return token
}

export async function getZohoAccessToken(): Promise<string> {
  if (_cachedToken && Date.now() < _cachedToken.expiresAt - 60_000) {
    return _cachedToken.token
  }
  return fetchFreshAccessToken()
}

/** Check if a Zoho API response body indicates an invalid token (MA_9067) */
function isInvalidTokenError(body: unknown): boolean {
  if (typeof body !== 'object' || body === null) return false
  const b = body as Record<string, unknown>
  const errorCode = (b.data as Record<string, unknown>)?.errorCode
  return errorCode === 'MA_9067'
}

/**
 * Execute a Zoho API call. Auto-retries once with a fresh token on MA_9067.
 */
async function zohoFetch(
  url: string,
  options: RequestInit,
  attempt = 1
): Promise<Response> {
  const token = await getZohoAccessToken()
  const headers = {
    ...(options.headers as Record<string, string> || {}),
    Authorization: `Zoho-oauthtoken ${token}`,
  }

  const res = await fetch(url, { ...options, headers })

  // For non-OK responses, check for invalid token and retry once
  if (!res.ok || res.status === 403) {
    const body = await res.clone().json().catch(() => null)
    if (attempt === 1 && isInvalidTokenError(body)) {
      console.error('[Zoho] MA_9067 invalid token — invalidating cache and retrying')
      invalidateTokenCache()
      return zohoFetch(url, options, 2)
    }
  }

  return res
}

/**
 * Verify Zoho connectivity. Returns { ok, error } — never throws.
 * Used by health check endpoint and cron.
 */
export async function checkZohoHealth(): Promise<{ ok: boolean; error?: string }> {
  try {
    const token = await getZohoAccessToken()
    // Lightweight call: list accounts (limit 1) to verify token works end-to-end
    const res = await fetch(`${ZOHO_API_BASE}/accounts?limit=1`, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    })
    if (!res.ok) {
      const body = await res.text()
      return { ok: false, error: `Zoho API returned ${res.status}: ${body}` }
    }
    const data = await res.json()
    if (isInvalidTokenError(data)) {
      invalidateTokenCache()
      return { ok: false, error: `Zoho token invalid (MA_9067). Rotate ZOHO_REFRESH_TOKEN in Supabase system_settings or Vercel env.` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

/**
 * Create a native Zoho Mail360 mailbox.
 * Returns the account_key used for all subsequent per-mailbox API calls.
 */
export async function provisionZohoAccount(
  username: string,
  firstName: string,
  lastName: string,
): Promise<string> {
  const emailid = `${username}@${DOMAIN()}`
  const res = await zohoFetch(`${ZOHO_API_BASE}/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountType: '1',
      emailid,
      displayName: `${firstName} ${lastName}`,
    }),
  })

  const data = await res.json()

  if (!res.ok || data.status?.code !== 200) {
    throw new Error(`Failed to provision Zoho account: ${JSON.stringify(data)}`)
  }

  return data.data.account_key as string
}

/**
 * Delete a Zoho Mail360 account.
 */
export async function deleteZohoAccount(accountKey: string): Promise<void> {
  const res = await zohoFetch(`${ZOHO_API_BASE}/accounts/${accountKey}`, {
    method: 'DELETE',
  })
  if (!res.ok && res.status !== 404) {
    const err = await res.text()
    throw new Error(`Failed to delete Zoho account: ${err}`)
  }
}

/**
 * Send an email from a Zoho Mail360 mailbox.
 */
export async function sendZohoEmail(
  accountKey: string,
  fromAddress: string,
  toAddress: string,
  subject: string,
  htmlContent: string,
  senderDisplayName?: string,
): Promise<{ messageId: string }> {
  const from = senderDisplayName ? `${senderDisplayName} <${fromAddress}>` : fromAddress
  const res = await zohoFetch(`${ZOHO_API_BASE}/accounts/${accountKey}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fromAddress: from,
      toAddress,
      subject,
      content: htmlContent,
      mailFormat: 'html',
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to send Zoho email: ${err}`)
  }

  const data = await res.json()
  return { messageId: data.data?.messageId || data.data?.message_id || '' }
}

/**
 * Given a profile, determine the proposed workspace email by checking
 * availability in the profiles table. Returns the first available address.
 * Used server-side to pre-populate the RecruitingEmailOverlay.
 */
export async function computeProposedEmail(
  firstName: string,
  lastName: string,
  jerseyNumber: string | null | undefined,
  gradYear: number | null | undefined,
): Promise<string> {
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()
  const domain = DOMAIN()
  const candidates = generateUsernameOptions(firstName, lastName, jerseyNumber || undefined)

  for (const candidate of candidates) {
    const email = `${candidate}@${domain}`
    const { count } = await admin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_email', email)
    if (!count) return email
  }

  // Last resort: append grad year
  const base = candidates[0]
  const fallback = gradYear ? `${base}${gradYear}` : `${base}x`
  return `${fallback}@${domain}`
}

/**
 * Generate a unique username using collision chain:
 * ryansmith → ryansmith33 → ryansmith-33 → ryansmith.33 → ryansmith.33x
 * Caller is responsible for checking availability against the DB.
 */
export function generateUsernameOptions(
  firstName: string,
  lastName: string,
  jerseyNumber?: string,
): string[] {
  const base = `${firstName}${lastName}`.toLowerCase().replace(/[^a-z0-9]/g, '')
  const candidates: string[] = [base]
  if (jerseyNumber) {
    candidates.push(`${base}${jerseyNumber}`)
    candidates.push(`${base}-${jerseyNumber}`)
    candidates.push(`${base}.${jerseyNumber}`)
  }
  return candidates
}
