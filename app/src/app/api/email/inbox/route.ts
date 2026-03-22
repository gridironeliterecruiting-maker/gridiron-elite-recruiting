import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { zohoFetch, getZohoFolders, findFolderId } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

const ZOHO_API_BASE = 'https://mail360.zoho.com/api'

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
    if (!inboxFolderId) {
      const names = folders.map((f: any) => f.folderName || f.name).join(', ')
      console.error('[email/inbox] Inbox folder not found. Available:', names)
      return NextResponse.json({ threads: [], unreadCount: 0 })
    }

    const res = await zohoFetch(
      `${ZOHO_API_BASE}/accounts/${accountKey}/messages?folderId=${inboxFolderId}&limit=100&sortby=date&sortorder=false`,
      {}
    )

    if (!res.ok) {
      const err = await res.text()
      console.error('[email/inbox] Zoho messages error:', res.status, err)
      return NextResponse.json({ threads: [], unreadCount: 0 })
    }

    const data = await res.json()
    const rawMessages: any[] = data.data || []

    // Debug: log field names from the first message so we know what's available
    if (rawMessages.length > 0) {
      console.log('[email/inbox] DEBUG raw message keys:', Object.keys(rawMessages[0]))
      console.log('[email/inbox] DEBUG first msg threadId fields:', {
        threadId: rawMessages[0].threadId,
        thread_id: rawMessages[0].thread_id,
        conversationId: rawMessages[0].conversationId,
        messageId: rawMessages[0].messageId,
        inReplyTo: rawMessages[0].inReplyTo,
      })
    }

    // Group messages by threadId — if threadId is missing/empty, use messageId as fallback (standalone)
    const threadMap = new Map<string, any[]>()
    for (const msg of rawMessages) {
      const tid = String(msg.threadId || msg.thread_id || msg.conversationId || '').trim()
      const key = tid || String(msg.messageId || msg.message_id || '')
      if (!key) continue
      if (!threadMap.has(key)) threadMap.set(key, [])
      threadMap.get(key)!.push(msg)
    }

    const threads: any[] = []
    for (const [threadKey, msgs] of threadMap) {
      // Sort messages in this thread by date descending — pick latest for display
      msgs.sort((a, b) => parseInt(b.receivedTime || b.sentDateInGMT || '0', 10) - parseInt(a.receivedTime || a.sentDateInGMT || '0', 10))
      const latest = msgs[0]

      const fromRaw = latest.fromAddress || latest.sender || ''
      const { name: fromName, email: fromEmail } = parseFrom(fromRaw)
      const receivedMs = parseInt(latest.receivedTime || latest.sentDateInGMT || '0', 10)
      const latestAt = receivedMs ? new Date(receivedMs).toISOString() : new Date().toISOString()

      const isFromAthlete = fromEmail.toLowerCase() === workspaceEmail
      const otherEmail = isFromAthlete
        ? parseFrom(latest.toAddress || '').email.toLowerCase()
        : fromEmail.toLowerCase()
      const otherName = isFromAthlete
        ? parseFrom(latest.toAddress || '').name
        : (fromName || fromEmail)

      const isUnread = String(latest.status) === '0'

      threads.push({
        threadId: threadKey,
        subject: latest.subject || '(No subject)',
        latestAt,
        otherName: otherName || otherEmail,
        otherEmail,
        snippet: latest.summary || '',
        unreadCount: msgs.filter(m => String(m.status) === '0').length,
        messageCount: msgs.length,
        hasUnread: isUnread,
        latestReceivedId: String(latest.messageId || ''),
        logoUrl: null as string | null,
        schoolName: null as string | null,
      })
    }

    // Sort threads: newest first
    threads.sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime())

    // Filter out rows where the athlete is the only participant (no coach involved)
    const filtered = threads.filter(t => t.threadId && t.otherEmail && t.otherEmail !== workspaceEmail)

    // Batch logo + coach name lookup
    const otherEmails = [...new Set(filtered.map(t => t.otherEmail).filter(Boolean))]
    if (otherEmails.length > 0) {
      const { data: coachRows } = await admin
        .from('coaches')
        .select('email, first_name, last_name, programs(logo_url, school_name)')
        .in('email', otherEmails)

      if (coachRows) {
        const coachMap = new Map<string, { logoUrl: string | null; schoolName: string | null; coachName: string | null }>()
        for (const row of coachRows as any[]) {
          const prog = Array.isArray(row.programs) ? row.programs[0] : row.programs
          const coachName = [row.first_name, row.last_name].filter(Boolean).join(' ') || null
          coachMap.set(row.email?.toLowerCase() || '', {
            logoUrl: prog?.logo_url || null,
            schoolName: prog?.school_name || null,
            coachName,
          })
        }
        for (const thread of filtered) {
          const entry = coachMap.get(thread.otherEmail)
          if (entry) {
            thread.logoUrl = entry.logoUrl
            thread.schoolName = entry.schoolName
            if (entry.coachName) thread.otherName = entry.coachName
          }
        }
      }
    }

    const unreadCount = filtered.reduce((sum, t) => sum + t.unreadCount, 0)
    return NextResponse.json({ threads: filtered, unreadCount })
  } catch (err: any) {
    console.error('[email/inbox] Unexpected error:', err?.message || err)
    return NextResponse.json({ threads: [], unreadCount: 0 })
  }
}
