/**
 * Zoho Mail360 helpers
 * Single app-level access token, per-mailbox account_key routing.
 * No per-user OAuth, no DWD, no suspension issues.
 */

const ZOHO_API_BASE = 'https://mail360.zoho.com/api'
const DOMAIN = () => process.env.ZOHO_DOMAIN || 'jetstreammail.com'

function getZohoCredentials() {
  const clientId = process.env.ZOHO_CLIENT_ID
  const clientSecret = process.env.ZOHO_CLIENT_SECRET
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Zoho Mail360 credentials not configured (ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN)')
  }
  return { clientId, clientSecret, refreshToken }
}

// Process-level token cache (~1 hour validity, resets on cold start)
let _cachedToken: { token: string; expiresAt: number } | null = null

export async function getZohoAccessToken(): Promise<string> {
  if (_cachedToken && Date.now() < _cachedToken.expiresAt - 60_000) {
    return _cachedToken.token
  }
  const { clientId, clientSecret, refreshToken } = getZohoCredentials()
  const res = await fetch(`${ZOHO_API_BASE}/access-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to get Zoho access token: ${err}`)
  }
  const data = await res.json()
  const token = data.data?.access_token as string
  const expiresIn = (data.data?.expires_in as number) || 3600
  _cachedToken = { token, expiresAt: Date.now() + expiresIn * 1000 }
  return token
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
  const token = await getZohoAccessToken()
  const emailid = `${username}@${DOMAIN()}`
  const res = await fetch(`${ZOHO_API_BASE}/accounts`, {
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      accountType: '1',
      emailid,
      displayName: `${firstName} ${lastName}`,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to provision Zoho account: ${err}`)
  }
  const data = await res.json()
  if (data.status?.code !== 200) {
    throw new Error(`Zoho account creation failed: ${JSON.stringify(data.status)}`)
  }
  return data.data.account_key as string
}

/**
 * Delete a Zoho Mail360 account.
 */
export async function deleteZohoAccount(accountKey: string): Promise<void> {
  const token = await getZohoAccessToken()
  const res = await fetch(`${ZOHO_API_BASE}/accounts/${accountKey}`, {
    method: 'DELETE',
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
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
  const token = await getZohoAccessToken()
  const from = senderDisplayName ? `${senderDisplayName} <${fromAddress}>` : fromAddress
  const res = await fetch(`${ZOHO_API_BASE}/accounts/${accountKey}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
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
