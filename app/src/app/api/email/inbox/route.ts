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
    // 1. Get inbox folder ID (needed to scope threads to inbox only)
    const folders = await getZohoFolders(accountKey)
    const inboxFolderId = findFolderId(folders, 'inbox')
    if (!inboxFolderId) {
      return NextResponse.json({ threads: [], archivedThreads: [], unreadCount: 0 })
    }

    // 2. Fetch inbox threads using the Threads API — native conversation grouping,
    //    includes sent replies so we see the full back-and-forth in the list.
    //    This replaces the old approach of fetching 200 inbox + 200 sent messages
    //    and grouping manually by subject+sender.
    const threadsRes = await zohoFetch(
      `${ZOHO_API_BASE}/accounts/${accountKey}/threads?folderId=${inboxFolderId}&includesent=true&limit=100`,
      {}
    )

    if (!threadsRes.ok) {
      console.error('[inbox] Zoho threads error:', threadsRes.status)
      return NextResponse.json({ threads: [], archivedThreads: [], unreadCount: 0 })
    }

    const threadsData = await threadsRes.json()
    if (threadsData?.status?.code && threadsData.status.code !== 200) {
      console.error('[inbox] Zoho API error:', threadsData.status)
      return NextResponse.json({ threads: [], archivedThreads: [], unreadCount: 0 })
    }

    const zohoThreads: any[] = threadsData?.data || []

    // DEBUG: log first 3 threads to inspect field names
    if (zohoThreads.length > 0) {
      console.log('[inbox:debug] sample threads:', JSON.stringify(zohoThreads.slice(0, 3).map((t: any) => ({
        threadId: t.threadId,
        messageId: t.messageId,
        threadCount: t.threadCount,
        messageCount: t.messageCount,
        count: t.count,
        subject: t.subject,
        status: t.status,
        fromAddress: t.fromAddress,
        sender: t.sender,
        toAddress: t.toAddress,
      })), null, 2))
      // Log all threadIds to detect duplicates
      const ids = zohoThreads.map((t: any) => t.threadId)
      const dupes = ids.filter((id: string, i: number) => ids.indexOf(id) !== i)
      if (dupes.length > 0) console.log('[inbox:debug] DUPLICATE threadIds from Zoho:', dupes)
    }

    // 3. Build normalised thread list from Zoho thread objects
    const threads = zohoThreads.map((t: any) => {
      const fromRaw = t.fromAddress || t.sender || ''
      const { name: fromName, email: fromEmail } = parseFrom(fromRaw)

      // Prefer the separate `sender` field for display name when available
      const displayName = t.sender && !t.sender.includes('@')
        ? t.sender.trim()
        : fromName

      const isMine = fromEmail === workspaceEmail
      // For threads where we sent the latest message, the "other" is the recipient
      const otherEmail = isMine
        ? parseFrom(t.toAddress || '').email
        : fromEmail
      const otherName = isMine
        ? parseFrom(t.toAddress || '').name || otherEmail
        : (displayName || fromEmail)

      const receivedMs = parseInt(t.receivedTime || t.sentDateInGMT || '0', 10)

      return {
        threadId: String(t.threadId || ''),          // Real Zoho thread ID
        latestMessageId: String(t.messageId || ''),   // Latest message in thread
        subject: t.subject || '(No subject)',
        latestAt: receivedMs ? new Date(receivedMs).toISOString() : new Date().toISOString(),
        otherName: otherName || otherEmail,
        otherEmail: otherEmail || '',
        snippet: t.summary || '',
        // Thread-level status: '0' = has unread, '1' = all read
        unreadCount: String(t.status) === '0' ? 1 : 0,
        messageCount: parseInt(String(t.threadCount || '1'), 10),
        hasUnread: String(t.status) === '0',
        latestReceivedId: String(t.messageId || ''),
        logoUrl: null as string | null,
        schoolName: null as string | null,
      }
    })
      .filter(t => t.otherEmail && t.otherEmail !== workspaceEmail)
      .sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime())

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

    const unreadCount = inboxThreads.reduce((sum, t) => sum + t.unreadCount, 0)
    return NextResponse.json({ threads: inboxThreads, archivedThreads, unreadCount })
  } catch (err: any) {
    console.error('[inbox] unexpected error:', err?.message || err)
    return NextResponse.json({ threads: [], archivedThreads: [], unreadCount: 0 })
  }
}
