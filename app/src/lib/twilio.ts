const TWILIO_API = 'https://api.twilio.com/2010-04-01'

/**
 * Normalize a user-entered phone number to E.164 format (+1XXXXXXXXXX).
 * Returns null if the number can't be normalized.
 */
export function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}

/**
 * Send an SMS via Twilio REST API. Fire-and-forget — logs errors but never throws.
 */
export async function sendSms(to: string, body: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_PHONE_NUMBER

  if (!sid || !token || !from) {
    console.warn('[twilio] Missing TWILIO env vars — skipping SMS')
    return
  }

  const res = await fetch(`${TWILIO_API}/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[twilio] SMS send failed:', res.status, err)
  } else {
    console.log('[twilio] SMS sent to', to)
  }
}
