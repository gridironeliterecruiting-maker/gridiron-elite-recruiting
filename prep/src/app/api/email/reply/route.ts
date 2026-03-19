import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getZohoAccessToken, sendZohoEmail } from '@/lib/workspace'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { messageId, toEmail, toName, replyBody } = body as {
    messageId: string
    toEmail: string
    toName?: string
    replyBody: string
  }

  if (!messageId || !toEmail || !replyBody?.trim()) {
    return NextResponse.json({ error: 'messageId, toEmail, and replyBody are required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('first_name, last_name, workspace_email, zoho_account_key')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const accountKey = (profile as any).zoho_account_key as string | null
  const workspaceEmail = (profile as any).workspace_email as string | null
  if (!accountKey || !workspaceEmail) {
    return NextResponse.json({ error: 'No Zoho account configured' }, { status: 400 })
  }

  const senderName = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()

  // Fetch original message to get subject for Re: threading
  let subject = 'Re: Your Message'
  try {
    const token = await getZohoAccessToken()
    const msgRes = await fetch(
      `https://mail360.zoho.com/api/accounts/${accountKey}/messages/${messageId}`,
      { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
    )
    if (msgRes.ok) {
      const msgData = await msgRes.json()
      const originalSubject = msgData.data?.subject || ''
      subject = originalSubject.startsWith('Re:') ? originalSubject : `Re: ${originalSubject}`
    }
  } catch {
    // Non-fatal — proceed with default subject
  }

  const htmlBody = `<div style="font-family: Arial, sans-serif; font-size: 14px; color: #222;">${replyBody.replace(/\n/g, '<br />')}</div>`
  const toAddress = toName ? `${toName} <${toEmail}>` : toEmail

  try {
    const result = await sendZohoEmail(accountKey, workspaceEmail, toAddress, subject, htmlBody, senderName)
    return NextResponse.json({ ok: true, messageId: result.messageId })
  } catch (err: any) {
    console.error('[email/reply] Error:', err)
    return NextResponse.json({ error: err.message || 'Send failed' }, { status: 500 })
  }
}
