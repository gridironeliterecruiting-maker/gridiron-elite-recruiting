import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { zohoFetch, getZohoFolders, findFolderId } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

const ZOHO_API_BASE = 'https://mail360.zoho.com/api'

/**
 * Parse a Zoho fromAddress field.
 * Zoho may return RFC 5322 ("Name <email>") or its own format ("<Name>email").
 * Sent folder entries have HTML-encoded angle brackets — decoded first.
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
    const folders = await getZohoFolders(accountKey)
    const inboxFolderId = findFolderId(folders, 'inbox')
    const sentFolderId = findFolderId(folders, 'sent')
    if (!inboxFolderId) {
      return NextResponse.json({ threads: [], archivedThreads: [], unreadCount: 0 })
    }

    // 2. Fetch MESSAGES (not threads) from inbox + sent in parallel.
    //    The messages endpoint returns every individual email — no grouping issues.
    //    We group by threadId ourselves to build the complete thread list.
    const diagLines: string[] = []
    const fetches: Promise<Response>[] = [
      zohoFetch(`${ZOHO_API_BASE}/accounts/${accountKey}/messages?folderId=${inboxFolderId}&limit=200`, {}),
    ]
    if (sentFolderId) {
      fetches.push(zohoFetch(`${ZOHO_API_BASE}/accounts/${accountKey}/messages?folderId=${sentFolderId}&limit=200`, {}))
    }
    const responses = await Promise.all(fetches)

    // Collect all raw messages from both folders
    const inboxMessageIds = new Set<string>()
    const allMessages: any[] = []
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
      for (const msg of entries) {
        if (i === 0) inboxMessageIds.add(String(msg.messageId || ''))
        allMessages.push(msg)
      }
    }

    // 3. Group messages by threadId to build thread list.
    //    For each thread, collect ALL messages so we can:
    //    - Use the latest message for display (subject, date, snippet)
    //    - Find the "other party" by looking at all messages (not just latest)
    //    - Track all messageIds for archive matching
    const threadGroups = new Map<string, any[]>()
    for (const msg of allMessages) {
      const tid = String(msg.threadId || msg.messageId || '')
      if (!tid) continue
      const group = threadGroups.get(tid) || []
      // Deduplicate — same message may appear in both inbox and sent
      if (!group.some((m: any) => String(m.messageId) === String(msg.messageId))) {
        group.push(msg)
      }
      threadGroups.set(tid, group)
    }
    diagLines.push(`THREADS=${threadGroups.size} from ${allMessages.length} messages`)

    // 4. Build normalised thread list from grouped messages
    const threads: {
      threadId: string
      latestMessageId: string
      allMessageIds: string[]
      subject: string
      latestAt: string
      otherName: string
      otherEmail: string
      snippet: string
      unreadCount: number
      messageCount: number
      hasUnread: boolean
      latestReceivedId: string
      logoUrl: string | null
      schoolName: string | null
    }[] = []

    for (const [threadId, messages] of threadGroups) {
      // Sort messages by time, latest last
      messages.sort((a: any, b: any) =>
        parseInt(a.receivedTime || a.sentDateInGMT || '0', 10) -
        parseInt(b.receivedTime || b.sentDateInGMT || '0', 10)
      )

      const latest = messages[messages.length - 1]
      const allMessageIds = messages.map((m: any) => String(m.messageId || ''))

      // Find the "other party" — scan all messages for someone who isn't us
      let otherEmail = ''
      let otherName = ''
      for (const msg of messages) {
        const fromRaw = msg.fromAddress || msg.sender || ''
        const { name, email } = parseFrom(fromRaw)
        if (email && email !== workspaceEmail) {
          otherEmail = email
          otherName = name || email
          break
        }
      }
      // If all messages are from us, use the toAddress of the latest message
      if (!otherEmail) {
        const firstTo = (latest.toAddress || '').split(',')[0].trim()
        const parsed = parseFrom(firstTo)
        otherEmail = parsed.email
        otherName = parsed.name || parsed.email
      }

      // If we're still talking to ourselves, skip this thread
      if (!otherEmail || otherEmail === workspaceEmail) {
        diagLines.push(`DROPPED:${threadId}|other=${otherEmail}|ws=${workspaceEmail}`)
        continue
      }

      const receivedMs = parseInt(latest.receivedTime || latest.sentDateInGMT || '0', 10)
      const hasUnread = messages.some((m: any) => String(m.status) === '0')

      threads.push({
        threadId,
        latestMessageId: String(latest.messageId || ''),
        allMessageIds,
        subject: latest.subject || messages[0]?.subject || '(No subject)',
        latestAt: receivedMs ? new Date(receivedMs).toISOString() : new Date().toISOString(),
        otherName: otherName || otherEmail,
        otherEmail: otherEmail || '',
        snippet: latest.summary || '',
        unreadCount: messages.filter((m: any) => String(m.status) === '0').length,
        messageCount: messages.length,
        hasUnread,
        latestReceivedId: String(latest.messageId || ''),
        logoUrl: null,
        schoolName: null,
      })
    }

    // Sort by latest message time, newest first
    threads.sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime())

    diagLines.push(`FILTER=${threads.length}`)
    for (const t of threads) {
      diagLines.push(`  T:${t.threadId}|${t.subject.substring(0, 40)}|other=${t.otherEmail}|name=${t.otherName}|msgs=${t.allMessageIds.join(';')}`)
    }

    // 5. Batch logo + coach name lookup from our database
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

    // 6. Load archived thread IDs from filed_emails and split inbox vs archived.
    //    Primary key: zoho thread_id. Fallback: message ID match, then email fallback.
    const { data: filedRows } = await admin
      .from('filed_emails')
      .select('from_email, subject, program_name, thread_id')
      .eq('user_id', user.id)

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
      // Match by threadId (correct case), any messageId in the thread (handles legacy
      // bug where message IDs were stored as thread_ids), or email fallback
      const matchedById = archivedStoredIds.has(thread.threadId)
      const matchedByMsgId = !matchedById && thread.allMessageIds.some(id => archivedStoredIds.has(id))
      const matchedByEmail = !matchedById && !matchedByMsgId && archivedEmailKeys.has(thread.otherEmail)

      if (matchedById || matchedByMsgId || matchedByEmail) {
        const programName = matchedById
          ? (programByStoredId.get(thread.threadId) || thread.schoolName || null)
          : matchedByMsgId
          ? (programByStoredId.get(thread.allMessageIds.find(id => archivedStoredIds.has(id))!) || thread.schoolName || null)
          : (programByEmailKey.get(thread.otherEmail) || thread.schoolName || null)
        archivedThreads.push({ ...thread, programName })
        diagLines.push(`  ARCHIVED:${thread.threadId}|match=${matchedById ? 'threadId' : matchedByMsgId ? 'msgId' : 'email'}|prog=${programName}`)
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
