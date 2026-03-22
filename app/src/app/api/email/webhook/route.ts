import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

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
  } catch (err: any) {
    console.error('[email/webhook] Error processing webhook:', err?.message || err)
    // Still return 200 to prevent Zoho from retrying on our errors
    return NextResponse.json({ ok: true })
  }
}

async function handleNewMail(payload: any) {
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
    .select('id, workspace_email')
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

  // TODO: Send SMS/text notification to athlete when coach emails them
  // This is where we'd check if fromAddress is a coach and send a text
}

// GET handler for webhook verification (some providers send a GET to verify the URL)
export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'mail360-webhook' })
}
