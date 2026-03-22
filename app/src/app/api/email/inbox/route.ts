import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { zohoFetch, getZohoFolders, findFolderId } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

const ZOHO_API_BASE = 'https://mail360.zoho.com/api'

async function fetchFolderMessages(accountKey: string, folderId: string, limit = 50): Promise<any[]> {
  const res = await zohoFetch(
    `${ZOHO_API_BASE}/accounts/${accountKey}/messages?folderId=${folderId}&limit=${limit}`,
    {}
  )
  if (!res.ok) {
    const err = await res.text()
    console.error('[email/inbox] Zoho messages error:', res.status, err, 'folderId:', folderId)
    return []
  }
  const data = await res.json()
  return data.data || []
}

function parseFrom(fromRaw: string): { name: string; email: string } {
  const match = fromRaw.match(/^(.*?)\s*<(.+?)>$/)
  const name = match ? match[1].trim().replace(/^"|"$/g, '') : fromRaw
  const email = match ? match[2] : fromRaw
  return { name: name || email, email }
}

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
  const workspaceEmail = ((profile as any)?.workspace_email as string | null)?.toLowerCase() || ''

  if (!accountKey) {
    return NextResponse.json({ threads: [], unreadCount: 0 })
  }

  try {
    // Get all folders once, find inbox + sent
    const folders = await getZohoFolders(accountKey)
    if (folders.length === 0) {
      console.error('[email/inbox] No folders returned for account:', accountKey)
      return NextResponse.json({ threads: [], unreadCount: 0 })
    }

    const inboxFolderId = findFolderId(folders, 'inbox')
    const sentFolderId = findFolderId(folders, 'sent', 'sent items', 'sent mail')

    if (!inboxFolderId) {
      const names = folders.map((f: any) => f.folderName || f.name).join(', ')
      console.error('[email/inbox] Inbox folder not found. Available:', names)
      return NextResponse.json({ threads: [], unreadCount: 0 })
    }

    // Fetch inbox and sent messages in parallel
    const [inboxMsgs, sentMsgs] = await Promise.all([
      fetchFolderMessages(accountKey, inboxFolderId, 50),
      sentFolderId ? fetchFolderMessages(accountKey, sentFolderId, 50) : Promise.resolve([]),
    ])

    // Tag each message and combine
    type TaggedMessage = { raw: any; isSent: boolean }
    const allMessages: TaggedMessage[] = [
      ...inboxMsgs.map(raw => ({ raw, isSent: false })),
      ...sentMsgs.map(raw => ({ raw, isSent: true })),
    ]

    // Group by threadId (fall back to messageId if no threadId)
    const threadMap = new Map<string, TaggedMessage[]>()
    for (const msg of allMessages) {
      const tid = msg.raw.threadId || msg.raw.thread_id || msg.raw.messageId || msg.raw.message_id || ''
      if (!tid) continue
      if (!threadMap.has(tid)) threadMap.set(tid, [])
      threadMap.get(tid)!.push(msg)
    }

    // Build thread summaries
    const threads = Array.from(threadMap.entries()).map(([threadId, msgs]) => {
      // Sort messages within thread newest-first to find latest
      const sorted = [...msgs].sort((a, b) => {
        const at = parseInt(a.raw.receivedTime || a.raw.received_time || '0', 10)
        const bt = parseInt(b.raw.receivedTime || b.raw.received_time || '0', 10)
        return bt - at
      })
      const latest = sorted[0].raw
      const latestIsSent = sorted[0].isSent

      const latestMs = parseInt(latest.receivedTime || latest.received_time || '0', 10)
      const latestAt = latestMs ? new Date(latestMs).toISOString() : new Date().toISOString()

      const fromRaw = latest.fromAddress || latest.from_address || ''
      const { name: latestFrom, email: latestFromEmail } = parseFrom(fromRaw)

      // Unread = inbox messages that are unread
      const unreadCount = msgs.filter(m => !m.isSent && !(m.raw.isRead ?? m.raw.is_read ?? true)).length

      return {
        threadId,
        subject: latest.subject || '(No subject)',
        latestAt,
        latestFrom: latestIsSent ? 'Me' : latestFrom,
        latestFromEmail,
        snippet: latest.summary || latest.snippet || '',
        unreadCount,
        messageCount: msgs.length,
        hasUnread: unreadCount > 0,
      }
    })

    // Sort threads by latest activity, newest first
    threads.sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime())

    const unreadCount = threads.reduce((sum, t) => sum + t.unreadCount, 0)
    return NextResponse.json({ threads, unreadCount })
  } catch (err: any) {
    console.error('[email/inbox] Unexpected error:', err?.message || err)
    return NextResponse.json({ threads: [], unreadCount: 0 })
  }
}
