import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// 1x1 transparent GIF
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
)

// Known bot/scanner user-agent patterns
const BOT_UA_PATTERNS = [
  /zoho/i,
  /mail.*scanner/i,
  /antivirus/i,
  /bot\b/i,
  /crawler/i,
  /spider/i,
  /preview/i,
  /prefetch/i,
  /java\//i,
  /python/i,
  /curl\//i,
  /wget\//i,
  /go-http/i,
  /okhttp/i,
  /apache-httpclient/i,
  /outlook.*safe/i,
  /mimecast/i,
  /barracuda/i,
  /proofpoint/i,
  /X11;.*Linux.*Chrome\/124/i, // link security scanner fingerprint
]

function isBotUserAgent(ua: string): boolean {
  if (!ua) return true // empty UA = scanner
  return BOT_UA_PATTERNS.some(pattern => pattern.test(ua))
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const recipientId = searchParams.get('rid')
  const campaignId = searchParams.get('cid')

  // Always return the pixel, but only log valid opens
  if (recipientId && campaignId) {
    const ua = request.headers.get('user-agent') || ''

    if (!isBotUserAgent(ua)) {
      try {
        const admin = createAdminClient()

        // Look up recipient sent_at and check for existing open
        const { data: recipient } = await admin
          .from('campaign_recipients')
          .select('sent_at, opened_at')
          .eq('id', recipientId)
          .single()

        const now = new Date()

        // Skip if email was sent less than 15 seconds ago (catches scanner prefetch on delivery)
        if (recipient?.sent_at) {
          const sentAt = new Date(recipient.sent_at)
          const secondsSinceSend = (now.getTime() - sentAt.getTime()) / 1000
          if (secondsSinceSend < 15) {
            return new NextResponse(PIXEL, { status: 200, headers: pixelHeaders() })
          }
        }

        // Skip if already logged an open for this recipient (deduplication)
        const { count } = await admin
          .from('email_events')
          .select('id', { count: 'exact', head: true })
          .eq('recipient_id', recipientId)
          .eq('event_type', 'opened')

        if ((count ?? 0) === 0) {
          await admin.from('email_events').insert({
            campaign_id: campaignId,
            recipient_id: recipientId,
            event_type: 'opened',
            metadata: {
              user_agent: ua,
              timestamp: now.toISOString(),
            },
          })

          // Also stamp opened_at on the recipient row
          if (!recipient?.opened_at) {
            await admin
              .from('campaign_recipients')
              .update({ opened_at: now.toISOString() })
              .eq('id', recipientId)
          }
        }
      } catch (error) {
        console.error('Track open error:', error)
      }
    }
  }

  return new NextResponse(PIXEL, { status: 200, headers: pixelHeaders() })
}

function pixelHeaders() {
  return {
    'Content-Type': 'image/gif',
    'Content-Length': PIXEL.length.toString(),
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  }
}
