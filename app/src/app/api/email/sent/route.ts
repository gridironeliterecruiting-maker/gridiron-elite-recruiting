import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { zohoFetch, getZohoFolders, findFolderId } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

const ZOHO_API_BASE = 'https://mail360.zoho.com/api'

/** Normalize subject for matching: strip Re:/Fwd: prefixes and whitespace */
function normalizeSubject(subject: string): string {
  return subject
    .replace(/^(Re:\s*|Fwd:\s*|Fw:\s*)+/i, '')
    .trim()
    .toLowerCase()
}

/**
 * GET /api/email/sent
 * Returns compose-sent emails that have NOT yet received a reply
 * and have NOT been archived.
 */
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

  const accountKey = (profile?.zoho_account_key as string | null) ?? null
  const workspaceEmail = ((profile?.workspace_email as string | null) ?? '').toLowerCase()

  if (!accountKey) {
    return NextResponse.json({ threads: [] })
  }

  try {
    // 1. Get compose_emails from our DB
    const { data: composeRows } = await admin
      .from('compose_emails')
      .select('*')
      .eq('user_id', user.id)
      .order('sent_at', { ascending: false })

    if (!composeRows || composeRows.length === 0) {
      return NextResponse.json({ threads: [] })
    }

    // 2. Check which compose emails have been archived (filed_emails)
    const { data: filedRows } = await admin
      .from('filed_emails')
      .select('from_email, subject')
      .eq('user_id', user.id)

    const archivedKeys = new Set<string>()
    if (filedRows) {
      for (const row of filedRows) {
        const key = `${(row.from_email || '').toLowerCase()}::${normalizeSubject(row.subject || '')}`
        archivedKeys.add(key)
      }
    }

    // 3. Fetch inbox messages from Zoho to detect replies
    const folders = await getZohoFolders(accountKey)
    const inboxFolderId = findFolderId(folders, 'inbox')

    const inboxKeySet = new Set<string>()
    if (inboxFolderId) {
      const inboxRes = await zohoFetch(
        `${ZOHO_API_BASE}/accounts/${accountKey}/messages?folderId=${inboxFolderId}&limit=200`,
        {}
      )
      if (inboxRes.ok) {
        const inboxData = await inboxRes.json()
        const inboxMessages: Array<{ fromAddress?: string; subject?: string }> = inboxData?.data || []
        for (const msg of inboxMessages) {
          const fromRaw = (msg.fromAddress || '').toLowerCase()
          const emailMatch = fromRaw.match(/([^\s<>]+@[^\s<>]+)/)
          const fromEmail = emailMatch ? emailMatch[1] : fromRaw
          const normSubj = normalizeSubject(msg.subject || '')
          inboxKeySet.add(`${fromEmail}::${normSubj}`)
        }
      }
    }

    // 4. Filter: remove replied (in inbox) AND archived (in filed_emails)
    const visible = composeRows.filter(row => {
      const toKey = `${row.to_address.toLowerCase()}::${normalizeSubject(row.subject)}`
      // If reply exists in inbox → hide from Sent (it's now an inbox thread)
      if (inboxKeySet.has(toKey)) return false
      // If archived → hide from Sent
      // Archive stores from_email as the "other party" email (the recipient for compose emails)
      if (archivedKeys.has(toKey)) return false
      return true
    })

    // 5. Build thread-shaped data — use DB sent_at for time (always correct UTC)
    const threads = visible.map(row => {
      const latestAt = row.sent_at || new Date().toISOString()

      return {
        threadId: row.message_id,
        latestMessageId: row.message_id,
        allMessageIds: [row.message_id],
        allMessages: [{
          id: row.message_id,
          from_name: 'You',
          from_email: workspaceEmail,
          subject: row.subject,
          snippet: '',
          received_at: latestAt,
          is_sent: true,
          is_read: true,
        }],
        subject: row.subject,
        latestAt,
        otherName: row.to_address,
        otherEmail: row.to_address.toLowerCase(),
        snippet: '',
        unreadCount: 0,
        messageCount: 1,
        hasUnread: false,
        latestReceivedId: row.message_id,
        logoUrl: null,
        schoolName: null,
      }
    })

    return NextResponse.json({ threads })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[email/sent] unexpected error:', msg)
    return NextResponse.json({ threads: [] })
  }
}
