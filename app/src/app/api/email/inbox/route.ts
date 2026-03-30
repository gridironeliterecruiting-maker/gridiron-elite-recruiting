import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { zohoFetch, getZohoFolders, findFolderId } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

const ZOHO_API_BASE = 'https://mail360.zoho.com/api'

/**
 * Parse a Zoho fromAddress / toAddress field.
 * Handles RFC 5322 ("Name <email>"), Zoho format ("<Name>email"),
 * and HTML-encoded variants from the sent folder.
 */
function parseFrom(fromRaw: string): { name: string; email: string } {
  if (!fromRaw) return { name: '', email: '' }

  // Zoho sent folder entries have HTML-encoded angle brackets — decode first
  let s = fromRaw
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')

  // RFC 5322: "Name" <email> or Name <email>
  const rfcMatch = s.match(/^(.*?)\s*<([^>@\s]+@[^>]+)>/)
  if (rfcMatch) {
    const name = rfcMatch[1].trim().replace(/^"|"$/g, '')
    const email = rfcMatch[2].trim().toLowerCase()
    return { name: name || email, email }
  }

  // Zoho display format: <Name>email@domain.com
  const zohoMatch = s.match(/^<([^>]*)>(.+@.+)$/)
  if (zohoMatch) {
    const name = zohoMatch[1].trim()
    const email = zohoMatch[2].trim().toLowerCase()
    return { name: name || email, email }
  }

  // Plain email address
  const plain = s.trim().toLowerCase()
  return { name: plain, email: plain }
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
    return NextResponse.json({ threads: [], archivedThreads: [], unreadCount: 0 })
  }

  try {
    // 1. Get folder IDs (1 Zoho call)
    const folders = await getZohoFolders(accountKey)
    const inboxFolderId = findFolderId(folders, 'inbox')
    const sentFolderId = findFolderId(folders, 'sent')
    if (!inboxFolderId) {
      return NextResponse.json({ threads: [], archivedThreads: [], unreadCount: 0 })
    }

    // 2. Fetch inbox + sent messages in parallel (2 Zoho calls)
    const diagLines: string[] = []
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
    diagLines.push(`INBOX raw=${inboxMessages.length} SENT raw=${sentMessages.length}`)

    // 3. Group inbox messages into conversations by normalized subject + sender
    //    This is the exact logic from commit 16c8375 that worked perfectly.
    const conversationMap = new Map<string, { inbox: any[]; sent: any[] }>()

    for (const msg of inboxMessages) {
      const normalizedSubject = normalizeSubject(msg.subject || '')
      const { email: fromEmail } = parseFrom(msg.fromAddress || '')
      const key = `${fromEmail.toLowerCase()}::${normalizedSubject}`

      const existing = conversationMap.get(key) || { inbox: [], sent: [] }
      existing.inbox.push(msg)
      conversationMap.set(key, existing)
    }

    // Match sent messages to existing conversations by toEmail::normalizedSubject
    for (const msg of sentMessages) {
      const normalizedSubject = normalizeSubject(msg.subject || '')
      const toRaw = (msg.toAddress || '').split(',')[0].trim()
      const { email: toEmail } = parseFrom(toRaw)
      const key = `${toEmail.toLowerCase()}::${normalizedSubject}`

      const existing = conversationMap.get(key)
      if (existing) {
        existing.sent.push(msg)
      }
    }

    diagLines.push(`CONVERSATIONS=${conversationMap.size}`)

    // 4. Build thread list from grouped conversations
    const threads = Array.from(conversationMap.entries()).map(([, conv]) => {
      const allMsgs = [...conv.inbox, ...conv.sent]

      // Sort all messages by time, latest first
      allMsgs.sort((a: any, b: any) => {
        const aMs = parseInt(a.receivedTime || a.sentDateInGMT || '0', 10)
        const bMs = parseInt(b.receivedTime || b.sentDateInGMT || '0', 10)
        return bMs - aMs
      })
      const latest = allMsgs[0]

      // Collect all message IDs for the thread detail fast path
      const allMessageIds = allMsgs.map((m: any) => String(m.messageId || ''))

      // Build per-message metadata (no body) — passed to client for thread detail rendering
      const allMessagesMeta = allMsgs
        .sort((a: any, b: any) => {
          const aMs = parseInt(a.receivedTime || a.sentDateInGMT || '0', 10)
          const bMs = parseInt(b.receivedTime || b.sentDateInGMT || '0', 10)
          return aMs - bMs // oldest first for conversation order
        })
        .map((m: any) => {
          const fromRaw = m.fromAddress || m.sender || ''
          const { name: fromName, email: fromEmail } = parseFrom(fromRaw)
          const receivedMs = parseInt(m.receivedTime || m.sentDateInGMT || '0', 10)
          const isSent = fromEmail.toLowerCase() === workspaceEmail
          return {
            id: String(m.messageId || ''),
            from_name: fromName || fromEmail,
            from_email: fromEmail,
            subject: m.subject || '(No subject)',
            snippet: m.summary || '',
            received_at: receivedMs ? new Date(receivedMs).toISOString() : new Date().toISOString(),
            is_sent: isSent,
            is_read: String(m.status) === '1' || isSent,
          }
        })

      // The "other party" is always the inbox sender (not us)
      const latestInbox = conv.inbox.sort((a: any, b: any) => {
        const aMs = parseInt(a.receivedTime || '0', 10)
        const bMs = parseInt(b.receivedTime || '0', 10)
        return bMs - aMs
      })[0]

      const fromRaw = latestInbox?.fromAddress || latestInbox?.sender || latest.fromAddress || latest.sender || ''
      const { name: fromName, email: fromEmail } = parseFrom(fromRaw)

      // If the latest message overall is from us, use the inbox sender as the "other"
      const latestFromRaw = latest.fromAddress || latest.sender || ''
      const { email: latestFromEmail } = parseFrom(latestFromRaw)
      const latestIsMine = latestFromEmail.toLowerCase() === workspaceEmail

      let otherEmail: string
      let otherName: string
      if (latestIsMine && latestInbox) {
        // Latest msg is ours — show the coach (inbox sender)
        otherEmail = fromEmail.toLowerCase()
        otherName = fromName || fromEmail
      } else {
        // Latest msg is from coach — show them
        const { name, email } = parseFrom(latestFromRaw)
        otherEmail = email.toLowerCase()
        otherName = name || email
      }

      const receivedMs = parseInt(latest.receivedTime || latest.sentDateInGMT || '0', 10)
      const latestAt = receivedMs ? new Date(receivedMs).toISOString() : new Date().toISOString()
      const unreadMsgs = conv.inbox.filter((m: any) => String(m.status) === '0')

      return {
        threadId: String(latestInbox?.messageId || latest.messageId || ''),
        latestMessageId: String(latest.messageId || ''),
        allMessageIds,
        allMessages: allMessagesMeta,
        subject: latest.subject || '(No subject)',
        latestAt,
        otherName: otherName || otherEmail,
        otherEmail,
        snippet: latest.summary || '',
        unreadCount: unreadMsgs.length,
        messageCount: allMsgs.length,
        hasUnread: unreadMsgs.length > 0,
        latestReceivedId: String(latestInbox?.messageId || latest.messageId || ''),
        logoUrl: null as string | null,
        schoolName: null as string | null,
      }
    }).filter(t => t.otherEmail && t.otherEmail !== workspaceEmail)
      .sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime())

    diagLines.push(`THREADS=${threads.length}`)
    for (const t of threads) {
      diagLines.push(`  T:${t.threadId}|${t.subject.substring(0, 40)}|other=${t.otherEmail}|msgs=${t.allMessageIds.length}`)
    }

    // 5. Batch logo + coach name lookup from our database (Supabase, not Zoho)
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

    // 6. Check which threads are archived — split into inbox vs archived (Supabase, not Zoho)
    const { data: filedRows } = await admin
      .from('filed_emails')
      .select('from_email, subject, program_name')
      .eq('user_id', user.id)

    const archivedKeys = new Set<string>()
    const archivedProgramMap = new Map<string, string>()
    if (filedRows) {
      for (const row of filedRows) {
        const key = `${(row.from_email || '').toLowerCase()}::${normalizeSubject(row.subject || '')}`
        archivedKeys.add(key)
        if (row.program_name) archivedProgramMap.set(key, row.program_name)
      }
    }

    const inboxThreads: typeof threads = []
    const archivedThreads: (typeof threads[0] & { programName: string | null })[] = []

    for (const thread of threads) {
      const key = `${thread.otherEmail.toLowerCase()}::${normalizeSubject(thread.subject)}`
      if (archivedKeys.has(key)) {
        archivedThreads.push({
          ...thread,
          programName: archivedProgramMap.get(key) || thread.schoolName || null,
        })
      } else {
        inboxThreads.push(thread)
      }
    }

    diagLines.push(`FINAL inbox=${inboxThreads.length} archived=${archivedThreads.length}`)

    // Write diagnostics to DB (temporary — for verification)
    try {
      await admin.from('system_settings').upsert({
        key: 'inbox_diag',
        value: JSON.stringify(diagLines),
      }, { onConflict: 'key' })
    } catch { /* ignore */ }

    const unreadCount = inboxThreads.reduce((sum, t) => sum + t.unreadCount, 0)
    return NextResponse.json({ threads: inboxThreads, archivedThreads, unreadCount })
  } catch (err: any) {
    console.error('[inbox] unexpected error:', err?.message || err)
    return NextResponse.json({ threads: [], archivedThreads: [], unreadCount: 0 })
  }
}
