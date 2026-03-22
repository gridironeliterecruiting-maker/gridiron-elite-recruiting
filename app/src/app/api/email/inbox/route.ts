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

/** Normalize subject for grouping: strip Re:/Fwd: prefixes and whitespace */
function normalizeSubject(subject: string): string {
  return subject
    .replace(/^(Re:\s*|Fwd:\s*|Fw:\s*)+/i, '')
    .trim()
    .toLowerCase()
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
    // Get inbox folder ID, then fetch inbox messages (2 API calls total)
    const folders = await getZohoFolders(accountKey)
    const inboxFolderId = findFolderId(folders, 'inbox')
    if (!inboxFolderId) {
      return NextResponse.json({ threads: [], unreadCount: 0 })
    }

    const inboxRes = await zohoFetch(
      `${ZOHO_API_BASE}/accounts/${accountKey}/messages?folderId=${inboxFolderId}&limit=200`,
      {}
    )

    if (!inboxRes.ok) {
      console.error('[inbox] Zoho messages error:', inboxRes.status)
      return NextResponse.json({ threads: [], unreadCount: 0 })
    }

    const inboxData = await inboxRes.json()
    if (inboxData?.status?.code && inboxData.status.code !== 200) {
      console.error('[inbox] Zoho API error:', inboxData.status)
      return NextResponse.json({ threads: [], unreadCount: 0 })
    }

    const inboxMessages: any[] = inboxData?.data || []

    // Group inbox messages into conversations by normalized subject + sender
    const conversationMap = new Map<string, any[]>()

    for (const msg of inboxMessages) {
      const normalizedSubject = normalizeSubject(msg.subject || '')
      const { email: fromEmail } = parseFrom(msg.fromAddress || '')
      const key = `${fromEmail.toLowerCase()}::${normalizedSubject}`

      const existing = conversationMap.get(key) || []
      existing.push(msg)
      conversationMap.set(key, existing)
    }

    // Build thread list
    const threads = Array.from(conversationMap.entries()).map(([, msgs]) => {
      // Sort by time, latest first
      msgs.sort((a: any, b: any) => {
        const aMs = parseInt(a.receivedTime || '0', 10)
        const bMs = parseInt(b.receivedTime || '0', 10)
        return bMs - aMs
      })
      const latest = msgs[0]

      const fromRaw = latest.fromAddress || latest.sender || ''
      const { name: fromName, email: fromEmail } = parseFrom(fromRaw)
      const receivedMs = parseInt(latest.receivedTime || latest.sentDateInGMT || '0', 10)
      const latestAt = receivedMs ? new Date(receivedMs).toISOString() : new Date().toISOString()

      const otherEmail = fromEmail.toLowerCase()
      const otherName = fromName || fromEmail
      const unreadMsgs = msgs.filter((m: any) => String(m.status) === '0')

      return {
        threadId: String(latest.messageId || ''),
        subject: latest.subject || '(No subject)',
        latestAt,
        otherName: otherName || otherEmail,
        otherEmail,
        snippet: latest.summary || '',
        unreadCount: unreadMsgs.length,
        messageCount: msgs.length,
        hasUnread: unreadMsgs.length > 0,
        latestReceivedId: String(latest.messageId || ''),
        logoUrl: null as string | null,
        schoolName: null as string | null,
      }
    }).filter(t => t.otherEmail && t.otherEmail !== workspaceEmail)
      .sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime())

    // Batch logo + coach name lookup
    const otherEmails = [...new Set(threads.map(t => t.otherEmail).filter(Boolean))]
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
        for (const thread of threads) {
          const entry = coachMap.get(thread.otherEmail)
          if (entry) {
            thread.logoUrl = entry.logoUrl
            thread.schoolName = entry.schoolName
            if (entry.coachName) thread.otherName = entry.coachName
          }
        }
      }
    }

    const unreadCount = threads.reduce((sum, t) => sum + t.unreadCount, 0)
    return NextResponse.json({ threads, unreadCount })
  } catch (err: any) {
    console.error('[inbox] unexpected error:', err?.message || err)
    return NextResponse.json({ threads: [], unreadCount: 0 })
  }
}
