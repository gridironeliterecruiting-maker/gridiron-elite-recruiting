// Gmail API utility functions for sending emails, managing tokens, and tracking

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

// Account tier limits (emails per day)
const TIER_LIMITS: Record<string, { daily: number; hourly: number; description: string }> = {
  new: { daily: 20, hourly: 5, description: 'New account (0-14 days)' },
  building: { daily: 50, hourly: 10, description: 'Building reputation (14-30 days)' },
  established: { daily: 100, hourly: 20, description: 'Established (30-90 days)' },
  veteran: { daily: 200, hourly: 30, description: 'Veteran (90+ days)' },
}

/**
 * Refresh an expired Gmail access token using the refresh token
 */
export async function refreshGmailToken(refreshToken: string): Promise<{
  access_token: string
  expires_in: number
}> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Failed to refresh Gmail token: ${error}`)
  }

  return res.json()
}

/**
 * Send an email via the Gmail API
 */
export async function sendGmailEmail(
  accessToken: string,
  to: string,
  subject: string,
  htmlBody: string,
  fromName?: string,
  fromEmail?: string
): Promise<{ id: string; threadId: string }> {
  // Build MIME message
  const from = fromName && fromEmail
    ? `${fromName} <${fromEmail}>`
    : fromEmail || 'me'

  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`
  const mimeMessage = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(htmlToPlainText(htmlBody)).toString('base64'),
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(htmlBody).toString('base64'),
    '',
    `--${boundary}--`,
  ].join('\r\n')

  // Base64url encode
  const raw = Buffer.from(mimeMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const res = await fetch(`${GMAIL_API_BASE}/users/me/messages/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Gmail API send failed: ${error}`)
  }

  return res.json()
}

/**
 * Get the Gmail address associated with an access token
 */
export async function getGmailAddress(accessToken: string): Promise<string> {
  const res = await fetch(`${GMAIL_API_BASE}/users/me/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    // Fallback to Google userinfo
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!userRes.ok) throw new Error('Failed to get Gmail address')
    const user = await userRes.json()
    return user.email
  }

  const profile = await res.json()
  return profile.emailAddress
}

/**
 * Replace merge tags in email templates
 * Tags use ((tag_name)) format - also handles {{ }} for backwards compat
 * Empty values are replaced with empty string (caller's template should handle gracefully)
 */
export function resolveEmailMergeTags(
  template: string,
  data: Record<string, string>
): string {
  // First handle "Coach ((Last Name))" special case
  let result = template.replace(/Coach\s+\(\(Last Name\)\)/g, (_match) => {
    return 'Coach ' + (data['Coach_Last_Name'] || data['Last_Name'] || '')
  })
  
  // Handle (( )) format (primary)
  result = result.replace(/\(\(([^)]+)\)\)/g, (_match, tag) => {
    const key = tag.trim().replace(/\s+/g, '_')
    return data[key] ?? ''
  })

  // Handle {{ }} format (backwards compat)
  result = result.replace(/\{\{([^}]+)\}\}/g, (_match, tag) => {
    const key = tag.trim().replace(/\s+/g, '_')
    return data[key] ?? ''
  })

  // Clean up lines that are just a label with no value (e.g., "• GPA: \n")
  result = result.replace(/^[•\-]\s*[A-Za-z\s]+:\s*$/gm, '')

  // Clean up empty bullet points and double blank lines
  result = result.replace(/\n{3,}/g, '\n\n')

  return result
}

/**
 * Add a tracking pixel to the end of an HTML email body
 */
export function addTrackingPixel(
  html: string,
  recipientId: string,
  campaignId: string
): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://gridironeliterecruiting.com'
  const pixelUrl = `${appUrl}/api/track/open?rid=${recipientId}&cid=${campaignId}`
  const pixel = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;border:0;" />`

  // Insert before closing body tag if present, otherwise append
  if (html.includes('</body>')) {
    return html.replace('</body>', `${pixel}</body>`)
  }
  return html + pixel
}

/**
 * Wrap all <a> tag hrefs through our click tracker
 */
export function wrapLinksForTracking(
  html: string,
  recipientId: string,
  campaignId: string
): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://gridironeliterecruiting.com'

  return html.replace(
    /<a\s+([^>]*?)href=["']([^"']+)["']([^>]*?)>/gi,
    (match, before, url, after) => {
      // Don't track mailto: links or our own tracking URLs
      if (url.startsWith('mailto:') || url.includes('/api/track/') || url.includes('/api/unsubscribe')) {
        return match
      }
      const trackedUrl = `${appUrl}/api/track/click?rid=${recipientId}&cid=${campaignId}&url=${encodeURIComponent(url)}`
      return `<a ${before}href="${trackedUrl}"${after}>`
    }
  )
}

/**
 * Add unsubscribe footer to email
 */
export function addUnsubscribeFooter(
  html: string,
  recipientEmail: string,
  campaignId: string
): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://gridironeliterecruiting.com'
  const unsubUrl = `${appUrl}/api/unsubscribe?email=${encodeURIComponent(recipientEmail)}&cid=${campaignId}`
  const footer = `
<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center;">
  <p>If you no longer wish to receive these emails, <a href="${unsubUrl}" style="color:#6b7280;text-decoration:underline;">unsubscribe here</a>.</p>
</div>`

  if (html.includes('</body>')) {
    return html.replace('</body>', `${footer}</body>`)
  }
  return html + footer
}

/**
 * Calculate send schedule based on recipient count and account tier
 * Returns an array of Date objects representing when each email should be sent
 */
export function calculateSendSchedule(
  recipientCount: number,
  accountTier: string,
  startDate?: Date
): Date[] {
  const start = startDate || new Date()
  const limits = TIER_LIMITS[accountTier] || TIER_LIMITS.new
  const { daily, hourly } = limits

  const schedule: Date[] = []
  let currentDate = new Date(start)
  let sentToday = 0
  let sentThisHour = 0
  let currentHour = currentDate.getHours()

  for (let i = 0; i < recipientCount; i++) {
    // Check hourly limit
    if (sentThisHour >= hourly) {
      // Move to next hour
      currentDate = new Date(currentDate)
      currentDate.setHours(currentDate.getHours() + 1, 0, 0, 0)
      sentThisHour = 0

      // Check if we moved to next day
      if (currentDate.getHours() < currentHour || currentDate.getHours() >= 22) {
        currentDate.setDate(currentDate.getDate() + 1)
        currentDate.setHours(9, 0, 0, 0) // Start at 9 AM next day
        sentToday = 0
      }
      currentHour = currentDate.getHours()
    }

    // Check daily limit
    if (sentToday >= daily) {
      currentDate = new Date(currentDate)
      currentDate.setDate(currentDate.getDate() + 1)
      currentDate.setHours(9, 0, 0, 0)
      sentToday = 0
      sentThisHour = 0
      currentHour = 9
    }

    // Add some randomness (1-5 minute gaps)
    const jitter = Math.floor(Math.random() * 4 + 1) * 60 * 1000
    const sendTime = new Date(currentDate.getTime() + jitter * (sentThisHour + 1))

    schedule.push(sendTime)
    sentToday++
    sentThisHour++
  }

  return schedule
}

/**
 * Determine account tier based on connection date and send history
 */
export function getAccountTier(
  connectedAt: Date | string,
  totalSends: number
): string {
  const connected = new Date(connectedAt)
  const now = new Date()
  const daysSinceConnect = Math.floor((now.getTime() - connected.getTime()) / (1000 * 60 * 60 * 24))

  if (daysSinceConnect >= 90 && totalSends >= 500) return 'veteran'
  if (daysSinceConnect >= 30 && totalSends >= 100) return 'established'
  if (daysSinceConnect >= 14 && totalSends >= 30) return 'building'
  return 'new'
}

/**
 * Get tier limits
 */
export function getTierLimits(tier: string) {
  return TIER_LIMITS[tier] || TIER_LIMITS.new
}

/**
 * Convert simple HTML to plain text (fallback for email clients that don't support HTML)
 */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(div|p|li|ul|ol|h[1-6])[^>]*>/gi, '\n')
    .replace(/<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
