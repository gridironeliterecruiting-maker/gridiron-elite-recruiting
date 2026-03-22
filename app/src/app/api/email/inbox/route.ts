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
    const folders = await getZohoFolders(accountKey)
    if (folders.length === 0) {
      return NextResponse.json({ threads: [], unreadCount: 0 })
    }

    const inboxFolderId = findFolderId(folders, 'inbox')
    const sentFolderId = findFolderId(folders, 'sent')
    if (!inboxFolderId) {
      return NextResponse.json({ threads: [], unreadCount: 0 })
    }

    // Fetch inbox messages AND sent messages to build complete conversations
    const [inboxRes, sentRes] = await Promise.all([
      zohoFetch(`${ZOHO_API_BASE}/accounts/${accountKey}/messages?folderId=${inboxFolderId}&limit=200`, {}),
      sentFolderId
        ? zohoFetch(`${ZOHO_API_BASE}/accounts/${accountKey}/messages?folderId=${sentFolderId}&limit=200`, {})
        : Promise.resolve(null),
    ])

    const inboxData = inboxRes.ok ? await inboxRes.json() : null
    const sentData = sentRes?.ok ? await sentRes.json() : null
    const inboxMessages: any[] = inboxData?.data || []
    const sentMessages: any[] = sentData?.data || []

    // Build conversation groups by normalized subject + contact email pair
    // This correctly groups: Cael sends "Hello Coach" → Coach replies "Re: Hello Coach"
    const conversationMap = new Map<string, { inbox: any[]; sent: any[]; latestMs: number }>()

    for (const msg of inboxMessages) {
      const normalizedSubject = normalizeSubject(msg.subject || '')
      const { email: fromEmail } = parseFrom(msg.fromAddress || '')
      const key = `${fromEmail.toLowerCase()}::${normalizedSubject}`

      const existing = conversationMap.get(key) || { inbox: [], sent: [], latestMs: 0 }
      existing.inbox.push(msg)
      const ms = parseInt(msg.receivedTime || msg.sentDateInGMT || '0', 10)
      if (ms > existing.latestMs) existing.latestMs = ms
      conversationMap.set(key, existing)
    }

    // Match sent messages to conversations by normalized subject + recipient
    for (const msg of sentMessages) {
      const normalizedSubject = normalizeSubject(msg.subject || '')
      const { email: toEmail } = parseFrom(msg.toAddress || '')
      const key = `${toEmail.toLowerCase()}::${normalizedSubject}`

      const existing = conversationMap.get(key)
      if (existing) {
        existing.sent.push(msg)
      }
    }

    // Build thread list from conversations
    const threads = Array.from(conversationMap.entries()).map(([key, conv]) => {
      // Use the latest inbox message as the thread representative
      const latestInbox = conv.inbox.sort((a: any, b: any) => {
        const aMs = parseInt(a.receivedTime || '0', 10)
        const bMs = parseInt(b.receivedTime || '0', 10)
        return bMs - aMs
      })[0]

      const fromRaw = latestInbox.fromAddress || latestInbox.sender || ''
      const { name: fromName, email: fromEmail } = parseFrom(fromRaw)
      const receivedMs = parseInt(latestInbox.receivedTime || latestInbox.sentDateInGMT || '0', 10)
      const latestAt = receivedMs ? new Date(receivedMs).toISOString() : new Date().toISOString()

      const otherEmail = fromEmail.toLowerCase()
      const otherName = fromName || fromEmail

      const unreadInbox = conv.inbox.filter((m: any) => String(m.status) === '0')
      const totalMessages = conv.inbox.length + conv.sent.length

      return {
        threadId: String(latestInbox.messageId || ''),
        subject: latestInbox.subject || '(No subject)',
        latestAt,
        otherName: otherName || otherEmail,
        otherEmail,
        snippet: latestInbox.summary || '',
        unreadCount: unreadInbox.length,
        messageCount: totalMessages,
        hasUnread: unreadInbox.length > 0,
        latestReceivedId: String(latestInbox.messageId || ''),
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
