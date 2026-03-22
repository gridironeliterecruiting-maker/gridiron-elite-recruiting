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
      console.error('[inbox] no folders for account:', accountKey)
      return NextResponse.json({ threads: [], unreadCount: 0 })
    }

    const inboxFolderId = findFolderId(folders, 'inbox')
    if (!inboxFolderId) {
      const names = folders.map((f: any) => f.folderName || f.name).join(', ')
      console.error('[inbox] inbox folder not found. folders:', names)
      return NextResponse.json({ threads: [], unreadCount: 0 })
    }

    // Zoho Mail360 Threads API — GET /accounts/{account_key}/threads
    const url = `${ZOHO_API_BASE}/accounts/${accountKey}/threads?folderId=${inboxFolderId}&limit=50`
    const res = await zohoFetch(url, {})

    if (!res.ok) {
      const errBody = await res.text()
      console.error(`[inbox] HTTP ${res.status}:`, errBody.substring(0, 300))
      return NextResponse.json({ threads: [], unreadCount: 0 })
    }

    const data = await res.json()

    if (data?.status?.code && data.status.code !== 200) {
      console.error('[inbox] Zoho API error:', JSON.stringify(data).substring(0, 300))
      return NextResponse.json({ threads: [], unreadCount: 0 })
    }

    // Group by threadId — threads API returns individual messages; same threadId = same conversation
    const rawMessages: any[] = data.data || []
    const threadMap = new Map<string, any>()

    for (const msg of rawMessages) {
      const threadId = String(msg.threadId || msg.messageId || '')
      if (!threadId) continue

      const existing = threadMap.get(threadId)
      const receivedMs = parseInt(msg.receivedTime || msg.sentDateInGMT || '0', 10)

      if (!existing || receivedMs > parseInt(existing._latestMs, 10)) {
        threadMap.set(threadId, { ...msg, _latestMs: String(receivedMs) })
      }
    }

    const threads = Array.from(threadMap.values()).map((t: any) => {
      const fromRaw = t.fromAddress || t.sender || ''
      const { name: fromName, email: fromEmail } = parseFrom(fromRaw)
      const receivedMs = parseInt(t.receivedTime || t.sentDateInGMT || '0', 10)
      const latestAt = receivedMs ? new Date(receivedMs).toISOString() : new Date().toISOString()

      const isFromAthlete = fromEmail.toLowerCase() === workspaceEmail
      const otherEmail = isFromAthlete
        ? parseFrom(t.toAddress || '').email.toLowerCase()
        : fromEmail.toLowerCase()
      const otherName = isFromAthlete
        ? parseFrom(t.toAddress || '').name
        : (fromName || fromEmail)

      const isUnread = String(t.status) === '0'
      const threadMessages = rawMessages.filter(m => String(m.threadId || m.messageId) === String(t.threadId || t.messageId))

      return {
        threadId: String(t.threadId || t.messageId || ''),
        subject: t.subject || '(No subject)',
        latestAt,
        otherName: otherName || otherEmail,
        otherEmail,
        snippet: t.summary || '',
        unreadCount: isUnread ? 1 : 0,
        messageCount: threadMessages.length || 1,
        hasUnread: isUnread,
        latestReceivedId: String(t.messageId || ''),
        logoUrl: null as string | null,
        schoolName: null as string | null,
      }
    }).filter(t => t.threadId && t.otherEmail)
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
