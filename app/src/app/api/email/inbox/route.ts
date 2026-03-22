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

    const [inboxMsgs, sentMsgs] = await Promise.all([
      fetchFolderMessages(accountKey, inboxFolderId, 50),
      sentFolderId ? fetchFolderMessages(accountKey, sentFolderId, 50) : Promise.resolve([]),
    ])

    type TaggedMessage = { raw: any; isSent: boolean }
    const allMessages: TaggedMessage[] = [
      ...inboxMsgs.map(raw => ({ raw, isSent: false })),
      ...sentMsgs.map(raw => ({ raw, isSent: true })),
    ]

    // Group by threadId
    const threadMap = new Map<string, TaggedMessage[]>()
    for (const msg of allMessages) {
      const tid = msg.raw.threadId || msg.raw.thread_id || msg.raw.messageId || msg.raw.message_id || ''
      if (!tid) continue
      if (!threadMap.has(tid)) threadMap.set(tid, [])
      threadMap.get(tid)!.push(msg)
    }

    const threads = Array.from(threadMap.entries()).map(([threadId, msgs]) => {
      const byNewest = [...msgs].sort((a, b) =>
        parseInt(b.raw.receivedTime || b.raw.received_time || '0', 10) -
        parseInt(a.raw.receivedTime || a.raw.received_time || '0', 10)
      )

      const latestMsg = byNewest[0]
      const latestMs = parseInt(latestMsg.raw.receivedTime || latestMsg.raw.received_time || '0', 10)
      const latestAt = latestMs ? new Date(latestMs).toISOString() : new Date().toISOString()

      // Use actual subject from the most recent message (verbatim — coach may have changed it)
      const subject = latestMsg.raw.subject || '(No subject)'

      // "Other person" = the participant who is NOT the athlete
      const otherMsg = msgs.find(m => {
        const { email } = parseFrom(m.raw.fromAddress || m.raw.from_address || '')
        return email.toLowerCase() !== workspaceEmail
      }) || byNewest[0]
      const { name: otherName, email: otherEmail } = parseFrom(
        otherMsg.raw.fromAddress || otherMsg.raw.from_address || ''
      )

      const snippet = latestMsg.raw.summary || latestMsg.raw.snippet || ''
      const unreadCount = msgs.filter(m => !m.isSent && !(m.raw.isRead ?? m.raw.is_read ?? true)).length
      const latestReceivedMsg = byNewest.find(m => !m.isSent)

      return {
        threadId,
        subject,
        latestAt,
        otherName: otherName || otherEmail,
        otherEmail: otherEmail.toLowerCase(),
        snippet,
        unreadCount,
        messageCount: msgs.length,
        hasUnread: unreadCount > 0,
        latestReceivedId: latestReceivedMsg?.raw.messageId || latestReceivedMsg?.raw.message_id || '',
        logoUrl: null as string | null,
        schoolName: null as string | null,
      }
    })

    // Sort threads by latest activity, newest first
    threads.sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime())

    // Batch logo lookup — one query for all coach emails
    const otherEmails = [...new Set(threads.map(t => t.otherEmail).filter(Boolean))]
    if (otherEmails.length > 0) {
      const { data: coachRows } = await admin
        .from('coaches')
        .select('email, programs(logo_url, school_name)')
        .in('email', otherEmails)

      if (coachRows) {
        const logoMap = new Map<string, { logoUrl: string | null; schoolName: string | null }>()
        for (const row of coachRows as any[]) {
          const prog = Array.isArray(row.programs) ? row.programs[0] : row.programs
          logoMap.set(row.email?.toLowerCase() || '', {
            logoUrl: prog?.logo_url || null,
            schoolName: prog?.school_name || null,
          })
        }
        for (const thread of threads) {
          const entry = logoMap.get(thread.otherEmail)
          if (entry) {
            thread.logoUrl = entry.logoUrl
            thread.schoolName = entry.schoolName
          }
        }
      }
    }

    const unreadCount = threads.reduce((sum, t) => sum + t.unreadCount, 0)
    return NextResponse.json({ threads, unreadCount })
  } catch (err: any) {
    console.error('[email/inbox] Unexpected error:', err?.message || err)
    return NextResponse.json({ threads: [], unreadCount: 0 })
  }
}
