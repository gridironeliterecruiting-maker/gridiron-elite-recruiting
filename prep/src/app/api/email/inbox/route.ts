import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getZohoAccessToken } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('workspace_email, zoho_account_key')
    .eq('id', user.id)
    .single()

  const accountKey = (profile as any)?.zoho_account_key as string | null
  if (!accountKey) {
    return NextResponse.json({ items: [], unreadCount: 0 })
  }

  try {
    const token = await getZohoAccessToken()

    const listRes = await fetch(
      `https://mail360.zoho.com/api/accounts/${accountKey}/messages?folder=Inbox&limit=25`,
      { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
    )

    if (!listRes.ok) {
      const err = await listRes.text()
      console.error('[email/inbox] Zoho list error:', err)
      return NextResponse.json({ items: [], unreadCount: 0, debug: `Zoho list error: ${err}` })
    }

    const listData = await listRes.json()
    const messages: any[] = listData.data || []

    if (messages.length === 0) {
      return NextResponse.json({ items: [], unreadCount: 0 })
    }

    const items = messages.map((m: any) => {
      const fromRaw: string = m.fromAddress || m.from_address || ''
      const match = fromRaw.match(/^(.*?)\s*<(.+?)>$/)
      const fromName = match ? match[1].trim().replace(/^"|"$/g, '') : fromRaw
      const fromEmail = match ? match[2] : fromRaw

      const receivedMs = parseInt(m.receivedTime || m.received_time || '0', 10)
      const receivedAt = receivedMs ? new Date(receivedMs).toISOString() : new Date().toISOString()

      return {
        id: m.messageId || m.message_id || '',
        thread_id: m.threadId || m.thread_id || m.messageId || m.message_id || '',
        from_name: fromName || fromEmail,
        from_email: fromEmail,
        subject: m.subject || '(No subject)',
        snippet: m.summary || m.snippet || '',
        received_at: receivedAt,
        is_read: m.isRead ?? m.is_read ?? true,
      }
    })

    const unreadCount = items.filter((i) => !i.is_read).length
    return NextResponse.json({ items, unreadCount })
  } catch (err: any) {
    console.error('[email/inbox] Unexpected error:', err?.message || err)
    return NextResponse.json({ items: [], unreadCount: 0, debug: `Unexpected error: ${err?.message}` })
  }
}
