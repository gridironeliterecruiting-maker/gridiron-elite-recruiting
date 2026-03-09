import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getWorkspaceGmailModifyToken } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

function parseHeader(headers: { name: string; value: string }[], name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || ''
}

function parseFromHeader(from: string): { name: string; email: string } {
  const match = from.match(/^(.*?)\s*<(.+?)>$/)
  if (match) return { name: match[1].trim().replace(/^"|"$/g, ''), email: match[2] }
  return { name: from, email: from }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('workspace_email')
    .eq('id', user.id)
    .single()

  const workspaceEmail = (profile as any)?.workspace_email as string | null

  if (!workspaceEmail) {
    return NextResponse.json({ items: [], unreadCount: 0 })
  }

  try {
    console.log('[email/inbox] Getting token for:', workspaceEmail)
    let token: string
    try {
      token = await getWorkspaceGmailModifyToken(workspaceEmail)
      console.log('[email/inbox] Token obtained successfully')
    } catch (tokenErr: any) {
      console.error('[email/inbox] Token error:', tokenErr?.message || tokenErr)
      return NextResponse.json({ items: [], unreadCount: 0, debug: `Token error: ${tokenErr?.message}` })
    }

    // List messages in INBOX
    const listRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=INBOX&maxResults=25',
      { headers: { Authorization: `Bearer ${token}` } }
    )

    if (!listRes.ok) {
      const err = await listRes.text()
      console.error('[email/inbox] Gmail list error:', err)
      return NextResponse.json({ items: [], unreadCount: 0, debug: `Gmail list error: ${err}` })
    }

    const listData = await listRes.json()
    console.log('[email/inbox] Gmail list response:', JSON.stringify(listData).slice(0, 200))
    const messages: { id: string; threadId: string }[] = listData.messages || []

    if (messages.length === 0) {
      return NextResponse.json({ items: [], unreadCount: 0, debug: 'Gmail returned 0 messages' })
    }

    // Fetch metadata for each message in parallel
    const metaResults = await Promise.all(
      messages.map(async ({ id, threadId }) => {
        const res = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From,Subject,Date`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        if (!res.ok) return null
        const data = await res.json()
        if (id === messages[0].id) {
          console.log('[email/inbox] First message headers:', JSON.stringify(data.payload?.headers || []))
          console.log('[email/inbox] First message snippet:', data.snippet?.slice(0, 100))
        }
        return { id, threadId, data }
      })
    )

    const items = metaResults
      .filter(Boolean)
      .map((m) => {
        const headers: { name: string; value: string }[] = m!.data.payload?.headers || []
        const fromRaw = parseHeader(headers, 'From')
        const { name: fromName, email: fromEmail } = parseFromHeader(fromRaw)
        const subject = parseHeader(headers, 'Subject') || '(No subject)'
        const dateStr = parseHeader(headers, 'Date')
        const receivedAt = dateStr ? new Date(dateStr).toISOString() : new Date().toISOString()
        const isRead = !(m!.data.labelIds || []).includes('UNREAD')

        return {
          id: m!.id,
          thread_id: m!.threadId,
          from_name: fromName || fromEmail,
          from_email: fromEmail,
          subject,
          snippet: m!.data.snippet || '',
          received_at: receivedAt,
          is_read: isRead,
        }
      })

    const unreadCount = items.filter((i) => !i.is_read).length

    return NextResponse.json({ items, unreadCount })
  } catch (err: any) {
    console.error('[email/inbox] Unexpected error:', err?.message || err)
    return NextResponse.json({ items: [], unreadCount: 0, debug: `Unexpected error: ${err?.message}` })
  }
}
