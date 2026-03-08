import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getWorkspaceGmailAccessToken } from '@/lib/workspace'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { recipientId, replyBody } = body as { recipientId: string; replyBody: string }

  if (!recipientId || !replyBody?.trim()) {
    return NextResponse.json({ error: 'recipientId and replyBody are required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Load recipient + verify ownership
  const { data: recipient } = await admin
    .from('campaign_recipients')
    .select(`
      id,
      campaign_id,
      coach_email,
      coach_name,
      program_name,
      campaigns!inner(user_id, name)
    `)
    .eq('id', recipientId)
    .maybeSingle()

  if (!recipient || (recipient as any).campaigns?.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (!recipient.coach_email) {
    return NextResponse.json({ error: 'Coach has no email address' }, { status: 400 })
  }

  // Load sender profile (includes workspace_email from migration 012)
  const { data: profile } = await admin
    .from('profiles')
    .select('first_name, last_name, email, workspace_email')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // Use workspace email if provisioned, else fall back to OAuth Gmail address
  const senderEmail = (profile as any).workspace_email || profile.email
  const isWorkspaceUser = !!(profile as any).workspace_email

  // Build email subject (Re: original subject if possible)
  const { data: latestEvent } = await admin
    .from('email_events')
    .select('metadata')
    .eq('recipient_id', recipientId)
    .in('event_type', ['sent', 'replied'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const originalSubject = latestEvent?.metadata?.subject || `Re: Recruiting Inquiry`
  const subject = originalSubject.startsWith('Re:') ? originalSubject : `Re: ${originalSubject}`

  // Format plain text + HTML body
  const plainBody = replyBody
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; font-size: 14px; color: #222;">
      ${replyBody.replace(/\n/g, '<br />')}
    </div>
  `

  // Encode as MIME message (RFC 2822)
  function buildMimeMessage(to: string, from: string, subj: string, plain: string, html: string) {
    const boundary = `boundary_${Date.now()}`
    const lines = [
      `From: ${profile.first_name} ${profile.last_name} <${from}>`,
      `To: ${to}`,
      `Subject: ${subj}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset=UTF-8`,
      ``,
      plain,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      ``,
      html,
      ``,
      `--${boundary}--`,
    ]
    return Buffer.from(lines.join('\r\n')).toString('base64url')
  }

  const raw = buildMimeMessage(recipient.coach_email, senderEmail, subject, plainBody, htmlBody)

  try {
    let accessToken: string

    if (isWorkspaceUser) {
      // Service account impersonation
      accessToken = await getWorkspaceGmailAccessToken(senderEmail)
    } else {
      // OAuth token from gmail_tokens
      const { data: tokenRow } = await admin
        .from('gmail_tokens')
        .select('access_token, refresh_token, token_expiry')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!tokenRow?.access_token) {
        return NextResponse.json({ error: 'No Gmail connection. Please connect Gmail in Campaigns.' }, { status: 400 })
      }

      // Refresh if expired
      const expiry = tokenRow.token_expiry ? new Date(tokenRow.token_expiry) : null
      if (expiry && expiry < new Date()) {
        const refreshRes = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://runwayrecruit.com'}/api/gmail/force-refresh`, {
          method: 'GET',
        })
        if (refreshRes.ok) {
          const { data: refreshed } = await admin
            .from('gmail_tokens')
            .select('access_token')
            .eq('user_id', user.id)
            .maybeSingle()
          accessToken = refreshed?.access_token || tokenRow.access_token
        } else {
          accessToken = tokenRow.access_token
        }
      } else {
        accessToken = tokenRow.access_token
      }
    }

    // Send via Gmail API
    const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    })

    if (!gmailRes.ok) {
      const errText = await gmailRes.text()
      console.error('[email/reply] Gmail API error:', errText)
      return NextResponse.json({ error: 'Failed to send reply via Gmail' }, { status: 500 })
    }

    const gmailData = await gmailRes.json()
    const gmailMessageId = gmailData.id

    // Log to email_send_log
    await admin.from('email_send_log').insert({
      user_id: user.id,
      recipient_id: recipientId,
      campaign_id: recipient.campaign_id,
      gmail_message_id: gmailMessageId,
      sent_at: new Date().toISOString(),
    })

    // Log to email_events
    await admin.from('email_events').insert({
      campaign_id: recipient.campaign_id,
      recipient_id: recipientId,
      event_type: 'sent',
      metadata: {
        subject,
        snippet: replyBody.substring(0, 100),
        direction: 'reply',
      },
    })

    return NextResponse.json({ ok: true, gmailMessageId })
  } catch (err: any) {
    console.error('[email/reply] Error:', err)
    return NextResponse.json({ error: err.message || 'Send failed' }, { status: 500 })
  }
}
