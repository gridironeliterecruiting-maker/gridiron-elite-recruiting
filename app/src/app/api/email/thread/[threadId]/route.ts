import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { zohoFetch, getZohoFolders, findFolderId } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

const ZOHO_API_BASE = 'https://mail360.zoho.com/api'

async function fetchFolderMessages(accountKey: string, folderId: string, limit = 100): Promise<any[]> {
  const res = await zohoFetch(
    `${ZOHO_API_BASE}/accounts/${accountKey}/messages?folderId=${folderId}&limit=${limit}`,
    {}
  )
  if (!res.ok) return []
  const data = await res.json()
  return data.data || []
}

async function fetchMessageBody(accountKey: string, messageId: string): Promise<string> {
  try {
    const res = await zohoFetch(
      `${ZOHO_API_BASE}/accounts/${accountKey}/messages/${messageId}`,
      {}
    )
    if (!res.ok) return ''
    const data = await res.json()
    return data.data?.content || data.data?.body || data.data?.htmlBody || data.data?.textBody || ''
  } catch {
    return ''
  }
}

function parseFrom(fromRaw: string): { name: string; email: string } {
  const match = fromRaw.match(/^(.*?)\s*<(.+?)>$/)
  const name = match ? match[1].trim().replace(/^"|"$/g, '') : fromRaw
  const email = match ? match[2] : fromRaw
  return { name: name || email, email }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const { threadId } = await params

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
  if (!accountKey) return NextResponse.json({ messages: [] })

  try {
    const folders = await getZohoFolders(accountKey)
    const inboxFolderId = findFolderId(folders, 'inbox')
    const sentFolderId = findFolderId(folders, 'sent', 'sent items', 'sent mail')

    const [inboxMsgs, sentMsgs] = await Promise.all([
      inboxFolderId ? fetchFolderMessages(accountKey, inboxFolderId, 100) : Promise.resolve([]),
      sentFolderId ? fetchFolderMessages(accountKey, sentFolderId, 100) : Promise.resolve([]),
    ])

    // Filter to messages belonging to this thread
    const matchThread = (raw: any) => {
      const tid = raw.threadId || raw.thread_id || raw.messageId || raw.message_id || ''
      return tid === threadId
    }

    const threadMsgs = [
      ...inboxMsgs.filter(matchThread).map(raw => ({ raw, isSent: false })),
      ...sentMsgs.filter(matchThread).map(raw => ({ raw, isSent: true })),
    ]

    // De-duplicate by messageId in case a message appears in both folders
    const seen = new Set<string>()
    const unique = threadMsgs.filter(m => {
      const id = m.raw.messageId || m.raw.message_id || ''
      if (seen.has(id)) return false
      seen.add(id)
      return true
    })

    // Fetch full bodies in parallel
    const messages = await Promise.all(
      unique.map(async ({ raw, isSent }) => {
        const msgId = raw.messageId || raw.message_id || ''
        const bodyHtml = msgId ? await fetchMessageBody(accountKey, msgId) : ''
        const body = bodyHtml ? stripHtml(bodyHtml) : (raw.summary || raw.snippet || '')

        const fromRaw = raw.fromAddress || raw.from_address || ''
        const { name: fromName, email: fromEmail } = parseFrom(fromRaw)
        const receivedMs = parseInt(raw.receivedTime || raw.received_time || '0', 10)

        return {
          id: msgId,
          from_name: fromName,
          from_email: fromEmail,
          subject: raw.subject || '(No subject)',
          body,
          snippet: raw.summary || raw.snippet || '',
          received_at: receivedMs ? new Date(receivedMs).toISOString() : new Date().toISOString(),
          is_sent: isSent,
          is_read: isSent || (raw.isRead ?? raw.is_read ?? true),
        }
      })
    )

    // Sort chronologically — oldest first for conversation display
    messages.sort((a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime())

    return NextResponse.json({ messages })
  } catch (err: any) {
    console.error('[email/thread] Unexpected error:', err?.message || err)
    return NextResponse.json({ messages: [] })
  }
}
