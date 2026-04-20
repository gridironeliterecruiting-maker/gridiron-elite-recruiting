import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSms, normalizePhone } from '@/lib/twilio'

export const dynamic = 'force-dynamic'

/**
 * Zoho Mail360 Webhook Receiver
 *
 * Receives POST notifications from Mail360 when events occur (newMail, etc.)
 * Payload fields (from Mail360 docs):
 *   account_key, event, message_id, thread_id, from_address, to_address,
 *   cc_address, bcc_address, subject, summary, sender, size, read_status,
 *   received_time, send_time_in_gmt, has_attachment, folder_id, folder_name,
 *   header_message_id, return_path, flag, operation
 */

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()
    const event = payload.event || payload.operation || ''

    console.log('[email/webhook] Received event:', event, '| account_key:', payload.account_key)

    if (event === 'newMail') {
      await handleNewMail(payload)
    }

    // Always return 200 so Zoho doesn't retry
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[email/webhook] Error processing webhook:', msg)
    // Still return 200 to prevent Zoho from retrying on our errors
    return NextResponse.json({ ok: true })
  }
}

interface ZohoNewMailPayload {
  account_key?: string
  thread_id?: string
  from_address?: string
  to_address?: string
  subject?: string
  summary?: string
  message_id?: string
  received_time?: string
}

async function handleNewMail(payload: ZohoNewMailPayload) {
  const accountKey = payload.account_key || ''
  const threadId = payload.thread_id || ''
  const fromAddress = payload.from_address || ''
  const toAddress = payload.to_address || ''
  const subject = payload.subject || ''
  const summary = payload.summary || ''
  const messageId = payload.message_id || ''
  const receivedTime = payload.received_time || ''

  if (!accountKey) {
    console.error('[email/webhook] newMail missing account_key')
    return
  }

  const admin = createAdminClient()

  // Look up which user owns this account_key
  const { data: profile } = await admin
    .from('profiles')
    .select('id, workspace_email, phone, sms_notifications_enabled')
    .eq('zoho_account_key', accountKey)
    .maybeSingle()

  if (!profile) {
    console.warn('[email/webhook] No user found for account_key:', accountKey)
    return
  }

  // Insert notification into email_notifications table
  // The client subscribes to this table via Supabase Realtime
  const { error } = await admin
    .from('email_notifications')
    .insert({
      user_id: profile.id,
      account_key: accountKey,
      thread_id: threadId,
      message_id: messageId,
      from_address: fromAddress,
      to_address: toAddress,
      subject,
      summary,
      received_at: receivedTime
        ? new Date(parseInt(receivedTime, 10)).toISOString()
        : new Date().toISOString(),
    })

  if (error) {
    console.error('[email/webhook] Failed to insert notification:', error.message)
  } else {
    console.log('[email/webhook] Notification saved for user:', profile.id, '| from:', fromAddress)
  }

  // Send SMS notification if the athlete has it enabled
  if (profile.sms_notifications_enabled && profile.phone) {
    const normalizedPhone = normalizePhone(profile.phone)
    if (normalizedPhone) {
      // Try to match sender to a coach + school for a richer message
      const { data: coach } = await admin
        .from('coaches')
        .select('first_name, last_name, program_id, programs(school_name)')
        .eq('email', fromAddress)
        .limit(1)
        .maybeSingle()

      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://runwayrecruit.com'
      const inboxUrl = `${siteUrl.replace(/^https?:\/\//, '')}/email`
      let message: string
      const programRow = coach?.programs as { school_name?: string } | null | undefined
      if (coach && programRow?.school_name) {
        message = `You received an email from ${coach.first_name} ${coach.last_name} at ${programRow.school_name}. View it now: ${inboxUrl}`
      } else {
        message = `You received a new recruiting email. View it now: ${inboxUrl}`
      }

      void sendSms(normalizedPhone, message).catch((err) => {
        console.error('[email/webhook] SMS send error:', err)
      })
    }
  }
}

// GET handler for webhook verification (some providers send a GET to verify the URL)
export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'mail360-webhook' })
}
