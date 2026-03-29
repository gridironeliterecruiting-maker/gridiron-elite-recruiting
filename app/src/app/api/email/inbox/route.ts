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
    // 1. Get folder IDs for inbox and sent — both are needed to show all threads
    const folders = await getZohoFolders(accountKey)
    const inboxFolderId = findFolderId(folders, 'inbox')
    const sentFolderId = findFolderId(folders, 'sent')
    if (!inboxFolderId) {
      return NextResponse.json({ threads: [], archivedThreads: [], unreadCount: 0 })
    }

    // 2. Fetch inbox threads AND sent threads in parallel.
    //    Inbox-only misses threads where Cael sent first and coach hasn't replied.
    //    Sent-only misses threads where a coach reached out cold.
    //    Both together = complete conversation list.
    const fetches: Promise<Response>[] = [
      zohoFetch(`${ZOHO_API_BASE}/accounts/${accountKey}/threads?folderId=${inboxFolderId}&limit=100`, {}),
    ]
    if (sentFolderId) {
      fetches.push(zohoFetch(`${ZOHO_API_BASE}/accounts/${accountKey}/threads?folderId=${sentFolderId}&limit=100`, {}))
    }
    const responses = await Promise.all(fetches)

    const rawThreads: any[] = []
    const diagLines: string[] = []
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
      const folderThreads = data?.data || []
      diagLines.push(`${source} raw=${folderThreads.length}`)
      for (const t of folderThreads) {
        diagLines.push(`  ${source}:${t.threadId}|${(t.subject || '').substring(0, 40)}|from=${(t.fromAddress || '').substring(0, 40)}|sender=${(t.sender || '').substring(0, 30)}`)
      }
      rawThreads.push(...folderThreads)
    }

    // Deduplicate by threadId — includesent=true can return the same thread twice
    // (once as inbox entry, once as sent entry). Keep the entry with the latest receivedTime.
    const threadMap = new Map<string, any>()
    for (const t of rawThreads) {
      const id = String(t.threadId || '')
      if (!id) continue
      const existing = threadMap.get(id)
      if (!existing || parseInt(t.receivedTime || '0', 10) > parseInt(existing.receivedTime || '0', 10)) {
        threadMap.set(id, t)
      }
    }
    const zohoThreads = [...threadMap.values()]
    diagLines.push(`DEDUP=${zohoThreads.length}`)

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

    const archivedThreadIds = new Set<string>()       // Zoho thread IDs
    const archivedEmailKeys = new Set<string>()        // Legacy: email::subject keys
    const programByThreadId = new Map<string, string>()
    const programByEmailKey = new Map<string, string>()

    if (filedRows) {
      for (const row of filedRows) {
        if (row.thread_id) {
          archivedThreadIds.add(String(row.thread_id))
          if (row.program_name) programByThreadId.set(String(row.thread_id), row.program_name)
        } else if (row.from_email) {
          // Legacy records without thread_id — match by email only
          const key = (row.from_email || '').toLowerCase()
          archivedEmailKeys.add(key)
          if (row.program_name) programByEmailKey.set(key, row.program_name)
        }
      }
    }

    const inboxThreads: typeof threads = []
    const archivedThreads: (typeof threads[0] & { programName: string | null })[] = []

    for (const thread of threads) {
      const isArchivedById = archivedThreadIds.has(thread.threadId)
      const isArchivedByEmail = !isArchivedById && archivedEmailKeys.has(thread.otherEmail)

      if (isArchivedById || isArchivedByEmail) {
        const programName = isArchivedById
          ? (programByThreadId.get(thread.threadId) || thread.schoolName || null)
          : (programByEmailKey.get(thread.otherEmail) || thread.schoolName || null)
        archivedThreads.push({ ...thread, programName })
      } else {
        inboxThreads.push(thread)
      }
    }

    diagLines.push(`FINAL inbox=${inboxThreads.length} archived=${archivedThreads.length}`)
    for (const t of inboxThreads) {
      diagLines.push(`  IN:${t.threadId}|${t.subject.substring(0, 40)}|${t.otherEmail}`)
    }
    for (const t of archivedThreads) {
      diagLines.push(`  AR:${t.threadId}|${t.subject.substring(0, 40)}|prog=${t.programName}`)
    }
    // Archived IDs from DB
    diagLines.push(`ARCH_IDS=[${[...archivedThreadIds].join(',')}]`)
    diagLines.push(`ARCH_EMAILS=[${[...archivedEmailKeys].join(',')}]`)

    console.error(`[DIAG]\n${diagLines.join('\n')}`)

    const unreadCount = inboxThreads.reduce((sum, t) => sum + t.unreadCount, 0)
    return NextResponse.json({ threads: inboxThreads, archivedThreads, unreadCount })
  } catch (err: any) {
    console.error('[inbox] unexpected error:', err?.message || err)
    return NextResponse.json({ threads: [], archivedThreads: [], unreadCount: 0 })
  }
}
