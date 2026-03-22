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

    // Zoho Mail360 Threads API — native conversation grouping
    const url = `${ZOHO_API_BASE}/accounts/${accountKey}/threads?folderId=${inboxFolderId}&limit=50&sortby=date&sortorder=false`
    console.log('[email/inbox] Calling Zoho threads URL:', url)
    const res = await zohoFetch(url, {})

    if (!res.ok) {
      const errBody = await res.text()
      console.error('[email/inbox] Zoho threads error — status:', res.status, '— body:', errBody)
      return NextResponse.json({ threads: [], unreadCount: 0 })
    }

    const data = await res.json()
    console.log('[email/inbox] Zoho threads response status code:', data?.status?.code, '| data count:', data?.data?.length)

    // Zoho returns status.code !== 200 even on 200 HTTP in some error cases
    if (data?.status?.code && data.status.code !== 200) {
      console.error('[email/inbox] Zoho threads API error body:', JSON.stringify(data))
      return NextResponse.json({ threads: [], unreadCount: 0 })
    }

    const rawThreads: any[] = data.data || []

    const threads = rawThreads.map((t: any) => {
      const fromRaw = t.fromAddress || t.sender || ''
      const { name: fromName, email: fromEmail } = parseFrom(fromRaw)
      const receivedMs = parseInt(t.receivedTime || t.sentDateInGMT || '0', 10)
      const latestAt = receivedMs ? new Date(receivedMs).toISOString() : new Date().toISOString()

      const isFromAthlete = fromEmail.toLowerCase() === workspaceEmail
      let otherEmail = isFromAthlete
        ? parseFrom(t.toAddress || '').email.toLowerCase()
        : fromEmail.toLowerCase()
      let otherName = isFromAthlete
        ? parseFrom(t.toAddress || '').name
        : (fromName || fromEmail)

      const isUnread = String(t.status) === '0'

      return {
        threadId: String(t.threadId || t.thread_id || t.messageId || ''),
        subject: t.subject || '(No subject)',
        latestAt,
        otherName: otherName || otherEmail,
        otherEmail,
        snippet: t.summary || '',
        unreadCount: isUnread ? 1 : 0,
        messageCount: t.threadCount || 1,
        hasUnread: isUnread,
        latestReceivedId: String(t.messageId || ''),
        logoUrl: null as string | null,
        schoolName: null as string | null,
      }
    }).filter(t => t.threadId && t.otherEmail)

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
    console.error('[email/inbox] Unexpected error:', err?.message || err)
    return NextResponse.json({ threads: [], unreadCount: 0 })
  }
}
