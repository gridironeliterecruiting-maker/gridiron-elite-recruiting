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
  let cleaned = html
    .replace(/<blockquote[^>]*>[\s\S]*?<\/blockquote>/gi, '')
    .replace(/<div[^>]*class="[^"]*gmail_quote[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<div[^>]*class="[^"]*yahoo_quoted[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<div[^>]*class="[^"]*moz-cite-prefix[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')

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
 * GET /api/email/thread/[threadId]?messageIds=id1,id2,id3
 *
 * Fast path: client passes the message IDs (from inbox route data).
 * We only fetch message bodies — N Zoho calls total.
 * No seed message, no folder discovery, no message list fetches.
 *
 * The client already has message metadata (from, to, subject, date)
 * from the inbox route. This endpoint only adds the body text.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  await params // consume params to avoid Next.js warnings

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('zoho_account_key')
    .eq('id', user.id)
    .single()

  const accountKey = (profile as any)?.zoho_account_key as string | null
  if (!accountKey) return NextResponse.json({ bodies: {} })

  try {
    const messageIdsParam = req.nextUrl.searchParams.get('messageIds')
    if (!messageIdsParam) {
      return NextResponse.json({ bodies: {} })
    }

    const messageIds = messageIdsParam.split(',').filter(Boolean)

    // Fetch all message bodies in parallel — N Zoho calls
    const bodies: Record<string, string> = {}
    await Promise.all(
      messageIds.map(async (id) => {
        const html = await fetchMessageBody(accountKey, id)
        bodies[id] = html ? stripHtml(html) : ''
      })
    )

    return NextResponse.json({ bodies })
  } catch (err: any) {
    console.error('[thread] unexpected error:', err?.message || err)
    return NextResponse.json({ bodies: {} })
  }
}
