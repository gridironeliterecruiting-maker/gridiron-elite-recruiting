import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getWorkspaceGmailAccessToken, getWorkspaceGmailModifyToken } from '@/lib/workspace'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { gmailMessageId, threadId, toEmail, toName, replyBody } = body as {
    gmailMessageId: string
    threadId?: string
    toEmail: string
    toName?: string
    replyBody: string
  }

  if (!gmailMessageId || !toEmail || !replyBody?.trim()) {
    return NextResponse.json({ error: 'gmailMessageId, toEmail, and replyBody are required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('first_name, last_name, workspace_email')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const workspaceEmail = (profile as any).workspace_email as string | null
  if (!workspaceEmail) {
    return NextResponse.json({ error: 'No workspace email configured' }, { status: 400 })
  }

  const senderName = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()

  // Fetch the original message to get Message-ID header for threading
  let originalMessageId = ''
  let subject = 'Re: Your Message'
  try {
    const readToken = await getWorkspaceGmailModifyToken(workspaceEmail)
    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmailMessageId}?format=metadata&metadataHeaders=Subject,Message-ID`,
      { headers: { Authorization: `Bearer ${readToken}` } }
    )
    if (msgRes.ok) {
      const msgData = await msgRes.json()
      const headers: { name: string; value: string }[] = msgData.payload?.headers || []
      const subjectHeader = headers.find((h) => h.name.toLowerCase() === 'subject')?.value || ''
      const messageIdHeader = headers.find((h) => h.name.toLowerCase() === 'message-id')?.value || ''
      originalMessageId = messageIdHeader
      subject = subjectHeader.startsWith('Re:') ? subjectHeader : `Re: ${subjectHeader}`
    }
  } catch {
    // Non-fatal — proceed without threading headers
  }

  const htmlBody = `<div style="font-family: Arial, sans-serif; font-size: 14px; color: #222;">${replyBody.replace(/\n/g, '<br />')}</div>`

  function buildMimeMessage() {
    const boundary = `boundary_${Date.now()}`
    const lines = [
      `From: ${senderName} <${workspaceEmail}>`,
      `To: ${toName ? `${toName} <${toEmail}>` : toEmail}`,
      `Subject: ${subject}`,
      ...(originalMessageId ? [`In-Reply-To: ${originalMessageId}`, `References: ${originalMessageId}`] : []),
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset=UTF-8`,
      ``,
      replyBody,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      ``,
      htmlBody,
      ``,
      `--${boundary}--`,
    ]
    return Buffer.from(lines.join('\r\n')).toString('base64url')
  }

  const raw = buildMimeMessage()

  try {
    const sendToken = await getWorkspaceGmailAccessToken(workspaceEmail)

    const sendBody: Record<string, string> = { raw }
    if (threadId) sendBody.threadId = threadId

    const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sendToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sendBody),
    })

    if (!gmailRes.ok) {
      const errText = await gmailRes.text()
      console.error('[email/reply] Gmail API error:', errText)
      return NextResponse.json({ error: 'Failed to send reply via Gmail' }, { status: 500 })
    }

    const gmailData = await gmailRes.json()
    return NextResponse.json({ ok: true, gmailMessageId: gmailData.id })
  } catch (err: any) {
    console.error('[email/reply] Error:', err)
    return NextResponse.json({ error: err.message || 'Send failed' }, { status: 500 })
  }
}
