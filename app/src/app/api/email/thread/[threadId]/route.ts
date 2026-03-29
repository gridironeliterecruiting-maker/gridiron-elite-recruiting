import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { zohoFetch, getZohoFolders, findFolderId } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

const ZOHO_API_BASE = 'https://mail360.zoho.com/api'

async function fetchMessageBody(accountKey: string, messageId: string): Promise<string> {
  try {
    // Mail360 "Get email content" API — /messages/{messageId}/content
    // The /messages/{messageId} endpoint only returns metadata, not the body
    const res = await zohoFetch(
      `${ZOHO_API_BASE}/accounts/${accountKey}/messages/${messageId}/content`,
      {}
    )
    if (!res.ok) return ''
    const data = await res.json()
    return data.data?.content || ''
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

/** Decode HTML entities — run twice to handle double-encoding (&amp;lt; → &lt; → <) */
function decodeEntities(text: string): string {
  function decodeOnce(s: string): string {
    return s
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
  }
  return decodeOnce(decodeOnce(text))
}

/** Strip quoted reply text from plain text content */
function stripQuotedReply(text: string): string {
  // Gmail format: "On Mon, Mar 22, 2026, 2:05 AM <email> wrote:"
  // Also: "On Mon, Mar 22, 2026 at 2:05 AM <email> wrote:"
  const idx = text.search(/\n?\s*On\s+\w{3},\s+\w{3}\s+\d{1,2},\s+\d{4}/i)
  if (idx > 0) return text.substring(0, idx).trim()

  // RFC format: "On Sun, 22 Mar 2026 07:33:20 -0700"
  const idx2 = text.search(/\n?\s*On\s+\w{3},\s+\d{1,2}\s+\w{3}\s+\d{4}\s+[\d:]/i)
  if (idx2 > 0) return text.substring(0, idx2).trim()

  // Outlook format: "From: Name <email>" reply header
  const idx3 = text.search(/\n?\s*-{2,}\s*Original Message\s*-{2,}/i)
  if (idx3 > 0) return text.substring(0, idx3).trim()

  // Gmail dash-wrapped quote header: "---- On Sun, 22 Mar 2026 ... wrote ----"
  const idx3b = text.search(/\n?\s*-{2,}\s*On\s+\w{3},?\s+\d{1,2}\s+\w{3}\s+\d{4}/i)
  if (idx3b > 0) return text.substring(0, idx3b).trim()

  // Email signature separator: "-- " or dashes on their own line (including at end of string)
  const idx4 = text.search(/\n\s*-{2,}\s*(\n|$)/)
  if (idx4 > 0) return text.substring(0, idx4).trim()

  // "From:" header block (forwarded/reply metadata without dashes)
  const idx5 = text.search(/\n\s*From:\s+.+\n\s*(Sent|Date|To):/i)
  if (idx5 > 0) return text.substring(0, idx5).trim()

  return text
}

function stripHtml(html: string): string {
  // Remove quoted reply blocks from Gmail/Outlook style replies
  let cleaned = html
    .replace(/<blockquote[^>]*>[\s\S]*<\/blockquote>/gi, '')
    .replace(/<div[^>]*class="[^"]*gmail_quote[^"]*"[^>]*>[\s\S]*<\/div>/gi, '')
    .replace(/<div[^>]*class="[^"]*yahoo_quoted[^"]*"[^>]*>[\s\S]*<\/div>/gi, '')
    .replace(/<div[^>]*class="[^"]*moz-cite-prefix[^"]*"[^>]*>[\s\S]*<\/div>/gi, '')

  // Strip HTML tags
  cleaned = cleaned
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')

  // Decode entities, then strip quoted replies from plain text
  cleaned = decodeEntities(cleaned)
  cleaned = stripQuotedReply(cleaned)

  return cleaned
    .replace(/\n{2,}/g, '\n')
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
    // Fast path: if caller passes messageIds, skip all list fetches — just return bodies.
    // This reduces Zoho calls from 4+N to N per thread open.
    const messageIdsParam = req.nextUrl.searchParams.get('messageIds')
    if (messageIdsParam) {
      const messageIds = messageIdsParam.split(',').filter(Boolean)
      const bodies = await Promise.all(messageIds.map(async id => {
        const html = await fetchMessageBody(accountKey, id)
        return html ? stripHtml(html) : ''
      }))
      const result: Record<string, string> = {}
      messageIds.forEach((id, i) => { result[id] = bodies[i] || '' })
      return NextResponse.json({ bodies: result })
    }

    // The threadId passed in is a messageId from the inbox.
    // First, get that message's metadata to find the subject and contact.
    const seedRes = await zohoFetch(`${ZOHO_API_BASE}/accounts/${accountKey}/messages/${threadId}`, {})
    const seedData = seedRes.ok ? await seedRes.json() : null
    const seedMsg = seedData?.data || null
    const seedSubject = (seedMsg?.subject || '').replace(/^(Re:\s*|Fwd:\s*|Fw:\s*)+/i, '').trim().toLowerCase()
    const seedFrom = parseFrom(seedMsg?.fromAddress || '').email.toLowerCase()
    const seedTo = parseFrom(seedMsg?.toAddress || '').email.toLowerCase()
    const contactEmail = seedFrom === workspaceEmail ? seedTo : seedFrom

    // Fetch inbox + sent messages and find all that match this conversation
    const folders = await getZohoFolders(accountKey)
    const inboxFolderId = findFolderId(folders, 'inbox')
    const sentFolderId = findFolderId(folders, 'sent')

    const [inboxRes, sentRes] = await Promise.all([
      inboxFolderId ? zohoFetch(`${ZOHO_API_BASE}/accounts/${accountKey}/messages?folderId=${inboxFolderId}&limit=200`, {}) : Promise.resolve(null),
      sentFolderId ? zohoFetch(`${ZOHO_API_BASE}/accounts/${accountKey}/messages?folderId=${sentFolderId}&limit=200`, {}) : Promise.resolve(null),
    ])

    const inboxMsgs: any[] = inboxRes?.ok ? (await inboxRes.json()).data || [] : []
    const sentMsgs: any[] = sentRes?.ok ? (await sentRes.json()).data || [] : []

    // Filter to messages in this conversation by matching normalized subject + contact
    const allMsgs = [...inboxMsgs, ...sentMsgs]
    const rawMessages = allMsgs.filter((msg: any) => {
      const subj = (msg.subject || '').replace(/^(Re:\s*|Fwd:\s*|Fw:\s*)+/i, '').trim().toLowerCase()
      if (subj !== seedSubject) return false
      // Check if contactEmail appears anywhere in from or to addresses
      // This handles all format variations: "Name <email>", "<email>", "email"
      const fromStr = (msg.fromAddress || '').toLowerCase()
      const toStr = (msg.toAddress || '').toLowerCase()
      return fromStr.includes(contactEmail) || toStr.includes(contactEmail)
    })

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
