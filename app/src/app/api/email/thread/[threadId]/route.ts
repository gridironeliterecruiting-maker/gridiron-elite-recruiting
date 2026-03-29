import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { zohoFetch } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

const ZOHO_API_BASE = 'https://mail360.zoho.com/api'

/**
 * Fetch the full HTML body of a single message.
 * The /messages/{id} metadata endpoint does not include body content —
 * a separate /content call is required per Zoho Mail360 API design.
 */
async function fetchMessageBody(accountKey: string, messageId: string): Promise<string> {
  try {
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

/**
 * Parse a Zoho fromAddress field.
 * Handles RFC 5322 ("Name <email>"), Zoho format ("<Name>email"), and plain email.
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

  const plain = fromRaw.trim().toLowerCase()
  return { name: plain, email: plain }
}

/** Decode HTML entities — run twice to handle double-encoding */
function decodeEntities(text: string): string {
  function once(s: string): string {
    return s
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
  }
  return once(once(text))
}

/**
 * Strip quoted reply content from plain text.
 * Removes the original message that gets included in replies,
 * leaving only the new content the sender actually wrote.
 */
function stripQuotedReply(text: string): string {
  // Gmail: "On Mon, Mar 22, 2026, 2:05 AM <email> wrote:"
  const idx1 = text.search(/\n?\s*On\s+\w{3},\s+\w{3}\s+\d{1,2},\s+\d{4}/i)
  if (idx1 > 0) return text.substring(0, idx1).trim()

  // RFC date format: "On Sun, 22 Mar 2026 07:33:20 -0700"
  const idx2 = text.search(/\n?\s*On\s+\w{3},\s+\d{1,2}\s+\w{3}\s+\d{4}\s+[\d:]/i)
  if (idx2 > 0) return text.substring(0, idx2).trim()

  // Outlook: "-----Original Message-----"
  const idx3 = text.search(/\n?\s*-{2,}\s*Original Message\s*-{2,}/i)
  if (idx3 > 0) return text.substring(0, idx3).trim()

  // Gmail dash-wrapped header: "---- On Sun, 22 Mar 2026 ... wrote ----"
  const idx4 = text.search(/\n?\s*-{2,}\s*On\s+\w{3},?\s+\d{1,2}\s+\w{3}\s+\d{4}/i)
  if (idx4 > 0) return text.substring(0, idx4).trim()

  // Forwarded message header: "---------- Forwarded message ---------"
  const idx5 = text.search(/\n?\s*-{5,}.*Forwarded message.*-{5,}/i)
  if (idx5 > 0) return text.substring(0, idx5).trim()

  // Standalone dash separator line (email signature or reply divider)
  // Matches "----" on its own line, including at end of string
  const idx6 = text.search(/\n\s*-{2,}\s*(\n|$)/)
  if (idx6 > 0) return text.substring(0, idx6).trim()

  // "From:" header block (reply/forward metadata)
  const idx7 = text.search(/\n\s*From:\s+.+\n\s*(Sent|Date|To):/i)
  if (idx7 > 0) return text.substring(0, idx7).trim()

  return text
}

/**
 * Convert an HTML email body to clean readable plain text.
 * Removes quoted reply content, strips tags, decodes entities.
 */
function stripHtml(html: string): string {
  // Remove quoted reply HTML blocks before stripping tags
  let cleaned = html
    .replace(/<blockquote[^>]*>[\s\S]*?<\/blockquote>/gi, '')
    .replace(/<div[^>]*class="[^"]*gmail_quote[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<div[^>]*class="[^"]*yahoo_quoted[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<div[^>]*class="[^"]*moz-cite-prefix[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')

  // Strip tags, preserve line breaks
  cleaned = cleaned
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')

  cleaned = decodeEntities(cleaned)
  cleaned = stripQuotedReply(cleaned)

  return cleaned
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * GET /api/email/thread/[threadId]
 *
 * Uses Zoho's native Threads API to load all messages in a conversation
 * in a single call, then fetches bodies in parallel.
 *
 * Zoho call budget: 1 (GET /threads/{threadId}) + N (body fetches)
 * Previously: 4 + N (seed message + folders + 200 inbox + 200 sent)
 */
export async function GET(
  req: NextRequest,
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
    // Single call to Zoho Threads API — returns all messages in the conversation
    // with full metadata. Eliminates the 3-call overhead of the old approach.
    const threadRes = await zohoFetch(
      `${ZOHO_API_BASE}/accounts/${accountKey}/threads/${threadId}?limit=50`,
      {}
    )

    if (!threadRes.ok) {
      console.error('[thread] Zoho threads error:', threadRes.status)
      return NextResponse.json({ messages: [] })
    }

    const threadData = await threadRes.json()
    if (threadData?.status?.code && threadData.status.code !== 200) {
      console.error('[thread] Zoho API error:', threadData.status)
      return NextResponse.json({ messages: [] })
    }

    const rawMessages: any[] = threadData?.data || []

    // Fetch all message bodies in parallel — one call per message
    const messages = await Promise.all(
      rawMessages.map(async (raw: any) => {
        const msgId = String(raw.messageId || '')
        const bodyHtml = msgId ? await fetchMessageBody(accountKey, msgId) : ''
        const body = bodyHtml ? stripHtml(bodyHtml) : (raw.summary || '')

        const fromRaw = raw.fromAddress || raw.sender || ''
        const { name: fromName, email: fromEmail } = parseFrom(fromRaw)
        // Prefer the separate `sender` field for display name
        const displayName = raw.sender && !raw.sender.includes('@')
          ? raw.sender.trim()
          : fromName

        const receivedMs = parseInt(raw.receivedTime || raw.sentDateInGMT || '0', 10)
        const isSent = fromEmail === workspaceEmail

        return {
          id: msgId,
          from_name: displayName || fromName || fromEmail,
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

    // Oldest message first for conversation display
    messages.sort((a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime())

    return NextResponse.json({ messages })
  } catch (err: any) {
    console.error('[thread] unexpected error:', err?.message || err)
    return NextResponse.json({ messages: [] })
  }
}
