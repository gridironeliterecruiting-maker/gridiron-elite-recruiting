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
 * Returns compose-sent emails that have NOT yet received a reply.
 * Once a reply arrives, the thread moves to Inbox and disappears from here.
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

  const accountKey = (profile as any)?.zoho_account_key as string | null
  const workspaceEmail = ((profile as any)?.workspace_email as string | null)?.toLowerCase() || ''

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

    // 2. Fetch inbox messages from Zoho to detect replies
    const folders = await getZohoFolders(accountKey)
    const inboxFolderId = findFolderId(folders, 'inbox')

    let inboxEmails: string[] = []
    if (inboxFolderId) {
      const inboxRes = await zohoFetch(
        `${ZOHO_API_BASE}/accounts/${accountKey}/messages?folderId=${inboxFolderId}&limit=200`,
        {}
      )
      if (inboxRes.ok) {
        const inboxData = await inboxRes.json()
        const inboxMessages: any[] = inboxData?.data || []
        // Build set of "fromEmail::normalizedSubject" keys for all inbox messages
        for (const msg of inboxMessages) {
          const fromRaw = (msg.fromAddress || '').toLowerCase()
          // Extract just the email from fromAddress
          const emailMatch = fromRaw.match(/([^\s<>]+@[^\s<>]+)/)
          const fromEmail = emailMatch ? emailMatch[1] : fromRaw
          const normSubj = normalizeSubject(msg.subject || '')
          inboxEmails.push(`${fromEmail}::${normSubj}`)
        }
      }
    }

    const inboxKeySet = new Set(inboxEmails)

    // 3. Filter out compose emails that have received a reply (now in inbox)
    const unreplied = composeRows.filter(row => {
      const key = `${row.to_address.toLowerCase()}::${normalizeSubject(row.subject)}`
      return !inboxKeySet.has(key)
    })

    // 4. Fetch sent message bodies from Zoho for unreplied compose emails
    const sentFolderId = findFolderId(folders, 'sent')
    let sentMessagesMap = new Map<string, any>()

    if (sentFolderId) {
      const sentRes = await zohoFetch(
        `${ZOHO_API_BASE}/accounts/${accountKey}/messages?folderId=${sentFolderId}&limit=200`,
        {}
      )
      if (sentRes.ok) {
        const sentData = await sentRes.json()
        const sentMessages: any[] = sentData?.data || []
        for (const msg of sentMessages) {
          sentMessagesMap.set(String(msg.messageId || ''), msg)
        }
      }
    }

    // 5. Build thread-shaped data for each unreplied compose email
    const threads = unreplied.map(row => {
      const zohoMsg = sentMessagesMap.get(row.message_id)
      const sentAtMs = zohoMsg
        ? parseInt(zohoMsg.sentDateInGMT || zohoMsg.receivedTime || '0', 10)
        : 0
      const latestAt = sentAtMs
        ? new Date(sentAtMs).toISOString()
        : row.sent_at || new Date().toISOString()

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
  } catch (err: any) {
    console.error('[email/sent] unexpected error:', err?.message || err)
    return NextResponse.json({ threads: [] })
  }
}
