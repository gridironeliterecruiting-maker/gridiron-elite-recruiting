import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { zohoFetch } from '@/lib/workspace'

const ZOHO_API_BASE = 'https://mail360.zoho.com/api'

/**
 * Send a reply using the Mail360 Send Reply API.
 *
 * This uses POST /accounts/{account_key}/messages/{messageId} with action: "reply"
 * which properly sets In-Reply-To and References headers and creates/updates
 * the conversation thread. DO NOT use the regular POST /messages endpoint
 * for replies — that creates standalone messages with no thread linkage.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { messageId: directId, gmailMessageId, replyBody } = body as {
    messageId?: string
    gmailMessageId?: string
    replyBody: string
  }
  const messageId = directId || gmailMessageId || ''

  if (!messageId || !replyBody?.trim()) {
    return NextResponse.json({ error: 'messageId and replyBody are required' }, { status: 400 })
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
  const fromAddress = senderName ? `${senderName} <${workspaceEmail}>` : workspaceEmail

  const htmlContent = `<div style="font-family: Arial, sans-serif; font-size: 14px; color: #222;">${replyBody.replace(/\n/g, '<br />')}</div>`

  try {
    // Mail360 Send Reply API — POST /accounts/{key}/messages/{messageId}
    // This creates a proper threaded reply with correct email headers
    const res = await zohoFetch(
      `${ZOHO_API_BASE}/accounts/${accountKey}/messages/${messageId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromAddress,
          action: 'reply',
          content: htmlContent,
          mailFormat: 'html',
        }),
      }
    )

    if (!res.ok) {
      const err = await res.text()
      console.error('[email/reply] Zoho Send Reply error:', err)
      return NextResponse.json({ error: 'Failed to send reply' }, { status: 500 })
    }

    const data = await res.json()
    return NextResponse.json({ ok: true, messageId: data.data?.messageId || '' })
  } catch (err: any) {
    console.error('[email/reply] Error:', err)
    return NextResponse.json({ error: err.message || 'Send failed' }, { status: 500 })
  }
}
