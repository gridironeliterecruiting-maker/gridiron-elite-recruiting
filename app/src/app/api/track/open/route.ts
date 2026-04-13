import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runCohortAnalysis } from '@/lib/scanner-detection'

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
  /X11;.*Linux.*Chrome\/124/i,   // link security scanner fingerprint
  /Chrome\/\d+\.0\.0\.0/i,       // headless Chrome — real Chrome reports specific build numbers (e.g. 144.0.1234.567)
  /Edge\/12\./i,                  // ancient Edge = scanner (Edge 12 is from 2015)
]

function isBotUserAgent(ua: string): boolean {
  if (!ua) return true // empty UA = scanner
  return BOT_UA_PATTERNS.some(pattern => pattern.test(ua))
}

// Scanner window: events within this many seconds of send are blocked
// when honeypot or cohort analysis has flagged the recipient
const SCANNER_WINDOW_SECONDS = 180

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

        // Look up recipient
        const { data: recipient } = await admin
          .from('campaign_recipients')
          .select('sent_at, opened_at, scanner_detected_at')
          .eq('id', recipientId)
          .single()

        const now = new Date()

        // If honeypot/cohort flagged this recipient AND we're still in the scanner window, skip
        if (recipient?.scanner_detected_at && recipient?.sent_at) {
          const sentAt = new Date(recipient.sent_at)
          const secondsSinceSend = (now.getTime() - sentAt.getTime()) / 1000
          if (secondsSinceSend < SCANNER_WINDOW_SECONDS) {
            return new NextResponse(PIXEL, { status: 200, headers: pixelHeaders() })
          }
        }

        // Skip if email was sent less than 15 seconds ago (catches scanner prefetch on delivery)
        if (recipient?.sent_at) {
          const sentAt = new Date(recipient.sent_at)
          const secondsSinceSend = (now.getTime() - sentAt.getTime()) / 1000
          if (secondsSinceSend < 15) {
            return new NextResponse(PIXEL, { status: 200, headers: pixelHeaders() })
          }
        }

        // Skip if already logged a real (unflagged) open for this recipient
        const { count } = await admin
          .from('email_events')
          .select('id', { count: 'exact', head: true })
          .eq('recipient_id', recipientId)
          .eq('event_type', 'opened')
          .is('scanner_flagged_at', null)

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

          // Run cohort analysis async — may detect domain-wide scanner pattern
          runCohortAnalysis(admin, recipientId, campaignId).catch(() => {})
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
