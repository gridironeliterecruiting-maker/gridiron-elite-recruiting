import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendZohoEmail } from '@/lib/workspace'

/**
 * POST /api/email/send
 * Sends a freeform email from the user's recruiting address.
 * Records the send in compose_emails so it appears in the Sent folder.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { toAddress, subject, body: emailBody } = body as {
    toAddress: string
    subject: string
    body: string
  }

  if (!toAddress?.trim() || !subject?.trim() || !emailBody?.trim()) {
    return NextResponse.json({ error: 'toAddress, subject, and body are required' }, { status: 400 })
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
  const htmlContent = `<div style="font-family: Arial, sans-serif; font-size: 14px; color: #222;">${emailBody.replace(/\n/g, '<br />')}</div>`

  try {
    const result = await sendZohoEmail(
      accountKey,
      workspaceEmail,
      toAddress.trim(),
      subject.trim(),
      htmlContent,
      senderName || undefined,
    )

    // Record in compose_emails so it shows in Sent folder
    await admin.from('compose_emails').insert({
      user_id: user.id,
      message_id: result.messageId,
      to_address: toAddress.trim().toLowerCase(),
      subject: subject.trim(),
    })

    return NextResponse.json({ ok: true, messageId: result.messageId })
  } catch (err: any) {
    console.error('[email/send] Error:', err)
    return NextResponse.json({ error: err.message || 'Send failed' }, { status: 500 })
  }
}
