import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { zohoFetch, getZohoFolders, findFolderId } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

const ZOHO_API_BASE = 'https://mail360.zoho.com/api'

/**
 * Parse a Zoho fromAddress field.
 * Zoho may return RFC 5322 ("Name <email>") or its own format ("<Name>email").
 * Falls back gracefully to plain email.
 */
function parseFrom(fromRaw: string): { name: string; email: string } {
  if (!fromRaw) return { name: '', email: '' }

  // RFC 5322: "Name" <email> or Name <email>
  const rfcMatch = fromRaw.match(/^(.*?)\s*<([^>@\s]+@[^>]+)>/)
  if (rfcMatch) {
    const name = rfcMatch[1].trim().replace(/^"|"$/g, '')
    const email = rfcMatch[2].trim().toLowerCase()
    return { name: name || email, email }
  }

  // Zoho display format: <Name>email@domain.com
  const zohoMatch = fromRaw.match(/^<([^>]*)>(.+@.+)$/)
  if (zohoMatch) {
    const name = zohoMatch[1].trim()
    const email = zohoMatch[2].trim().toLowerCase()
    return { name: name || email, email }
  }

  // Plain email address
  const plain = fromRaw.trim().toLowerCase()
  return { name: plain, email: plain }
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
    // 1. Get folder IDs — need both inbox and sent to find all conversation threads.
    //    Inbox has threads where last message is incoming.
    //    Sent has threads where Cael replied last (coach's earlier reply still exists).
    const folders = await getZohoFolders(accountKey)
    const inboxFolderId = findFolderId(folders, 'inbox')
    const sentFolderId = findFolderId(folders, 'sent')
    if (!inboxFolderId) {
      return NextResponse.json({ threads: [], archivedThreads: [], unreadCount: 0 })
    }

    // 2. Fetch inbox + sent in parallel to get complete thread list.
    const diagLines: string[] = []
    const fetches: Promise<Response>[] = [
      zohoFetch(`${ZOHO_API_BASE}/accounts/${accountKey}/threads?folderId=${inboxFolderId}&limit=100`, {}),
    ]
    if (sentFolderId) {
      fetches.push(zohoFetch(`${ZOHO_API_BASE}/accounts/${accountKey}/threads?folderId=${sentFolderId}&limit=100`, {}))
    }
    const responses = await Promise.all(fetches)

    // Track which threadIds appear in inbox — used to filter sent-only campaigns
    const inboxThreadIds = new Set<string>()
    const rawEntries: any[] = []
    for (let i = 0; i < responses.length; i++) {
      const res = responses[i]
      const source = i === 0 ? 'INBOX' : 'SENT'
      if (!res.ok) {
        diagLines.push(`${source} ERROR ${res.status}`)
        continue
      }
      const data = await res.json()
      if (data?.status?.code && data.status.code !== 200) {
        diagLines.push(`${source} API ERROR ${JSON.stringify(data.status)}`)
        continue
      }
      const entries = data?.data || []
      diagLines.push(`${source} raw=${entries.length}`)
      for (const t of entries) {
        if (i === 0) inboxThreadIds.add(String(t.threadId || ''))
        rawEntries.push(t)
      }
    }

    // Deduplicate by threadId — Zoho returns one entry per message, not per thread.
    // Keep the entry with the latest receivedTime for each thread.
    const threadMap = new Map<string, any>()
    for (const t of rawEntries) {
      const id = String(t.threadId || '')
      if (!id) continue
      const existing = threadMap.get(id)
      if (!existing || parseInt(t.receivedTime || '0', 10) > parseInt(existing.receivedTime || '0', 10)) {
        threadMap.set(id, t)
      }
    }
    const zohoThreads = [...threadMap.values()]
    diagLines.push(`DEDUP=${zohoThreads.length} inboxThreadIds=${inboxThreadIds.size}`)

    // 3. Build normalised thread list from Zoho thread objects
    const threads = zohoThreads.map((t: any) => {
      const fromRaw = t.fromAddress || t.sender || ''
      const { name: fromName, email: fromEmail } = parseFrom(fromRaw)

      // Use fromName from parseFrom — it properly extracts the name.
      // The raw `sender` field often contains angle-bracket-wrapped emails
      // like "<paulkong3@gmail.com>" which renders as HTML entities in React.
      const displayName = fromName

      const isMine = fromEmail === workspaceEmail

      // When we sent the latest message, the other party is the recipient.
      // toAddress may be a comma-separated list — take the first valid address.
      let otherEmail = fromEmail
      let otherName = displayName || fromEmail
      if (isMine) {
        const firstTo = (t.toAddress || '').split(',')[0].trim()
        const parsed = parseFrom(firstTo)
        otherEmail = parsed.email
        otherName = parsed.name || parsed.email
      }

      const receivedMs = parseInt(t.receivedTime || t.sentDateInGMT || '0', 10)

      return {
        threadId: String(t.threadId || ''),
        latestMessageId: String(t.messageId || ''),
        subject: t.subject || '(No subject)',
        latestAt: receivedMs ? new Date(receivedMs).toISOString() : new Date().toISOString(),
        otherName: otherName || otherEmail,
        otherEmail: otherEmail || '',
        snippet: t.summary || '',
        unreadCount: String(t.status) === '0' ? 1 : 0,
        // threadCount is unreliable from Zoho list endpoint (returns 0).
        // Set to 0 here; ConversationView overwrites with real messages.length when opened.
        messageCount: 0,
        hasUnread: String(t.status) === '0',
        latestReceivedId: String(t.messageId || ''),
        logoUrl: null as string | null,
        schoolName: null as string | null,
      }
    })
      // Only drop threads where we are talking to ourselves (otherEmail = our own address).
      // Do NOT drop threads where otherEmail is empty — we'd lose replied-to threads.
      .filter(t => {
        const dominated = !t.threadId || t.otherEmail === workspaceEmail
        if (dominated) diagLines.push(`DROPPED:${t.threadId}|other=${t.otherEmail}|ws=${workspaceEmail}`)
        return !dominated
      })
      .sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime())

    diagLines.push(`FILTER=${threads.length}`)
    for (const t of threads) {
      diagLines.push(`  T:${t.threadId}|${t.subject.substring(0, 40)}|other=${t.otherEmail}|name=${t.otherName}`)
    }

    // 4. Batch logo + coach name lookup from our database
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

    // 5. Load archived thread IDs from filed_emails and split inbox vs archived.
    //    Primary key: zoho thread_id. Fallback: from_email match for legacy records.
    const { data: filedRows } = await admin
      .from('filed_emails')
      .select('from_email, subject, program_name, thread_id')
      .eq('user_id', user.id)

    // Build a set of all stored IDs from filed_emails.
    // These may be real Zoho thread IDs OR message IDs (legacy bug).
    // We match against both thread.threadId and thread.latestMessageId to handle both cases.
    const archivedStoredIds = new Set<string>()
    const archivedEmailKeys = new Set<string>()
    const programByStoredId = new Map<string, string>()
    const programByEmailKey = new Map<string, string>()

    if (filedRows) {
      for (const row of filedRows) {
        if (row.thread_id) {
          archivedStoredIds.add(String(row.thread_id))
          if (row.program_name) programByStoredId.set(String(row.thread_id), row.program_name)
        }
        // Always index by email — stored thread_ids may be message IDs (legacy bug)
        // that don't match any current thread. Email is the reliable fallback.
        if (row.from_email) {
          const key = (row.from_email || '').toLowerCase()
          archivedEmailKeys.add(key)
          if (row.program_name) programByEmailKey.set(key, row.program_name)
        }
      }
    }
    diagLines.push(`ARCH stored=${archivedStoredIds.size} emails=${archivedEmailKeys.size} keys=[${[...archivedEmailKeys].join(',')}]`)

    const inboxThreads: typeof threads = []
    const archivedThreads: (typeof threads[0] & { programName: string | null })[] = []

    for (const thread of threads) {
      // Match by threadId (correct case) OR by latestMessageId (handles legacy bug
      // where message IDs were stored as thread_ids in filed_emails)
      const matchedById = archivedStoredIds.has(thread.threadId)
      const matchedByMsgId = !matchedById && archivedStoredIds.has(thread.latestMessageId)
      const matchedByEmail = !matchedById && !matchedByMsgId && archivedEmailKeys.has(thread.otherEmail)

      if (matchedById || matchedByMsgId || matchedByEmail) {
        const programName = matchedById
          ? (programByStoredId.get(thread.threadId) || thread.schoolName || null)
          : matchedByMsgId
          ? (programByStoredId.get(thread.latestMessageId) || thread.schoolName || null)
          : (programByEmailKey.get(thread.otherEmail) || thread.schoolName || null)
        archivedThreads.push({ ...thread, programName })
        diagLines.push(`  ARCHIVED:${thread.threadId}|msgId=${thread.latestMessageId}|match=${matchedById ? 'threadId' : matchedByMsgId ? 'msgId' : 'email'}|prog=${programName}`)
      } else {
        inboxThreads.push(thread)
      }
    }

    diagLines.push(`FINAL inbox=${inboxThreads.length} archived=${archivedThreads.length}`)
    diagLines.push(`STORED_IDS=[${[...archivedStoredIds].join(',')}]`)

    // Write diagnostics to DB so we can read them without relying on Vercel logs
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
