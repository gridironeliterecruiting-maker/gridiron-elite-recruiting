/**
 * Google Workspace Admin SDK helpers
 * Uses a service account with domain-wide delegation to provision/manage
 * @flightschoolmail.com accounts without any per-user OAuth.
 */

interface ServiceAccountKey {
  client_email: string
  private_key: string
}

function getServiceAccountKey(): ServiceAccountKey {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY env var is not set')
  return JSON.parse(raw)
}

const DOMAIN = () => process.env.GOOGLE_WORKSPACE_DOMAIN || 'flightschoolmail.com'
const ADMIN_EMAIL = () => process.env.GOOGLE_WORKSPACE_ADMIN_EMAIL!

/**
 * Create a signed JWT and exchange it for a Google access token.
 * Used for service account + domain-wide delegation (impersonation).
 */
async function getAccessToken(scopes: string[], impersonate: string): Promise<string> {
  const key = getServiceAccountKey()

  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: key.client_email,
    sub: impersonate,
    scope: scopes.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }

  const encode = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url')

  const signingInput = `${encode(header)}.${encode(payload)}`

  // Sign with RS256 using the service account private key
  const crypto = await import('node:crypto')
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(signingInput)
  const signature = sign.sign(key.private_key, 'base64url')

  const jwt = `${signingInput}.${signature}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to get access token: ${err}`)
  }

  const data = await res.json()
  return data.access_token as string
}

/**
 * Get an access token that can send Gmail as the given workspace email.
 * Used by the email queue processor to send from athlete workspace inboxes.
 */
export async function getWorkspaceGmailAccessToken(workspaceEmail: string): Promise<string> {
  return getAccessToken(['https://www.googleapis.com/auth/gmail.send'], workspaceEmail)
}

/**
 * Check whether a username (without domain) is available in Workspace.
 */
export async function checkUsernameAvailable(username: string): Promise<boolean> {
  const email = `${username}@${DOMAIN()}`
  const token = await getAccessToken(
    ['https://www.googleapis.com/auth/admin.directory.user.readonly'],
    ADMIN_EMAIL()
  )

  const res = await fetch(
    `https://admin.googleapis.com/admin/directory/v1/users/${encodeURIComponent(email)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  if (res.status === 404) return true   // user does not exist → available
  if (res.ok) return false              // user exists → taken
  const err = await res.text()
  throw new Error(`Workspace user lookup failed: ${err}`)
}

/**
 * Generate a unique username using the collision chain:
 * ryansmith → ryansmith33 → ryansmith-33 → ryansmith.33 → ryansmith.33x
 */
export async function generateUsername(
  firstName: string,
  lastName: string,
  jerseyNumber?: string
): Promise<string> {
  const base = `${firstName}${lastName}`.toLowerCase().replace(/[^a-z0-9]/g, '')

  const candidates: string[] = [base]
  if (jerseyNumber) {
    candidates.push(`${base}${jerseyNumber}`)
    candidates.push(`${base}-${jerseyNumber}`)
    candidates.push(`${base}.${jerseyNumber}`)
  }

  for (const username of candidates) {
    const available = await checkUsernameAvailable(username)
    if (available) return username
  }

  // All candidates taken — add a random letter suffix
  const suffix = jerseyNumber ? `${jerseyNumber}` : ''
  const fallback = `${base}.${suffix}${String.fromCharCode(97 + Math.floor(Math.random() * 26))}`
  console.error(`[workspace] Username collision for ${base}, falling back to ${fallback}`)
  return fallback
}

/**
 * Create a new Google Workspace account for an athlete.
 */
export async function provisionWorkspaceAccount(
  username: string,
  password: string,
  firstName: string,
  lastName: string
): Promise<void> {
  const token = await getAccessToken(
    ['https://www.googleapis.com/auth/admin.directory.user'],
    ADMIN_EMAIL()
  )

  const res = await fetch('https://admin.googleapis.com/admin/directory/v1/users', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      primaryEmail: `${username}@${DOMAIN()}`,
      name: { givenName: firstName, familyName: lastName },
      password,
      changePasswordAtNextLogin: false,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to provision workspace account: ${err}`)
  }
}

/**
 * Suspend a workspace account (called when subscription lapses).
 */
export async function suspendWorkspaceAccount(username: string): Promise<void> {
  const email = `${username}@${DOMAIN()}`
  const token = await getAccessToken(
    ['https://www.googleapis.com/auth/admin.directory.user'],
    ADMIN_EMAIL()
  )

  const res = await fetch(
    `https://admin.googleapis.com/admin/directory/v1/users/${encodeURIComponent(email)}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ suspended: true }),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to suspend workspace account: ${err}`)
  }
}

/**
 * Permanently delete a workspace account (admin use only).
 */
export async function deleteWorkspaceAccount(username: string): Promise<void> {
  const email = `${username}@${DOMAIN()}`
  const token = await getAccessToken(
    ['https://www.googleapis.com/auth/admin.directory.user'],
    ADMIN_EMAIL()
  )

  const res = await fetch(
    `https://admin.googleapis.com/admin/directory/v1/users/${encodeURIComponent(email)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }
  )

  if (!res.ok && res.status !== 404) {
    const err = await res.text()
    throw new Error(`Failed to delete workspace account: ${err}`)
  }
}
