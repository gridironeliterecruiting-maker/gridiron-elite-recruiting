import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { zohoFetch } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

const ZOHO_API_BASE = 'https://mail360.zoho.com/api'

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
  const workspaceEmail = ((profile as any)?.workspace_email as string | null)?.toLowerCase() || ''
  if (!accountKey) return NextResponse.json({ messages: [] })

  try {
    // Use Zoho's Threads API — returns all messages in the conversation natively
    const res = await zohoFetch(
      `${ZOHO_API_BASE}/accounts/${accountKey}/threads/${threadId}?limit=100`,
      {}
    )

    if (!res.ok) {
      const err = await res.text()
      console.error('[email/thread] Zoho thread fetch error:', res.status, err)
      return NextResponse.json({ messages: [] })
    }

    const data = await res.json()
    const rawMessages: any[] = data.data || []

    // Fetch full bodies in parallel
    const messages = await Promise.all(
      rawMessages.map(async (raw: any) => {
        const msgId = String(raw.messageId || raw.message_id || '')
        const bodyHtml = msgId ? await fetchMessageBody(accountKey, msgId) : ''
        const body = bodyHtml ? stripHtml(bodyHtml) : (raw.summary || '')

        const fromRaw = raw.fromAddress || raw.sender || ''
        const { name: fromName, email: fromEmail } = parseFrom(fromRaw)
        const receivedMs = parseInt(raw.receivedTime || raw.sentDateInGMT || '0', 10)
        const isSent = fromEmail.toLowerCase() === workspaceEmail

        return {
          id: msgId,
          from_name: fromName,
          from_email: fromEmail,
          subject: raw.subject || '(No subject)',
          body,
          snippet: raw.summary || '',
          received_at: receivedMs ? new Date(receivedMs).toISOString() : new Date().toISOString(),
          is_sent: isSent,
          is_read: String(raw.status) === '1' || isSent,
        }
      })
    )

    // Oldest first for conversation display
    messages.sort((a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime())

    return NextResponse.json({ messages })
  } catch (err: any) {
    console.error('[email/thread] Unexpected error:', err?.message || err)
    return NextResponse.json({ messages: [] })
  }
}
