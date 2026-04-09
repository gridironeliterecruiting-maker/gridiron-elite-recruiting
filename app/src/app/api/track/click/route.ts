import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runCohortAnalysis } from '@/lib/scanner-detection'

// Known bot/scanner user-agent patterns (same list as open tracker)
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
  /Chrome\/109\.0\.0\.0/i,       // Microsoft Defender Safe Links scanner
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
  const targetUrl = searchParams.get('url')

  if (!targetUrl) {
    return NextResponse.json({ error: 'Missing URL' }, { status: 400 })
  }

  if (recipientId && campaignId) {
    const ua = request.headers.get('user-agent') || ''

    if (!isBotUserAgent(ua)) {
      try {
        const admin = createAdminClient()
        const now = new Date()
        const nowISO = now.toISOString()

        const { data: recipient } = await admin
          .from('campaign_recipients')
          .select('sent_at, scanner_detected_at')
          .eq('id', recipientId)
          .single()

        // If honeypot/cohort flagged this recipient AND we're still in the scanner window, skip
        if (recipient?.scanner_detected_at && recipient?.sent_at) {
          const sentAt = new Date(recipient.sent_at)
          const secondsSinceSend = (now.getTime() - sentAt.getTime()) / 1000
          if (secondsSinceSend < SCANNER_WINDOW_SECONDS) {
            return NextResponse.redirect(targetUrl, 302)
          }
        }

        // Skip clicks within 15 seconds of send (scanner prefetch)
        if (recipient?.sent_at) {
          const sentAt = new Date(recipient.sent_at)
          const secondsSinceSend = (now.getTime() - sentAt.getTime()) / 1000
          if (secondsSinceSend < 15) {
            return NextResponse.redirect(targetUrl, 302)
          }
        }

        // A click implies an open — backfill if no open event exists
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
              timestamp: nowISO,
              inferred_from: 'click',
            },
          })

          // Stamp opened_at on recipient row
          await admin
            .from('campaign_recipients')
            .update({ opened_at: nowISO })
            .eq('id', recipientId)
        }

        await admin.from('email_events').insert({
          campaign_id: campaignId,
          recipient_id: recipientId,
          event_type: 'clicked',
          metadata: {
            url: targetUrl,
            user_agent: ua,
            timestamp: nowISO,
          },
        })

        // Run cohort analysis async — may detect domain-wide scanner pattern
        runCohortAnalysis(admin, recipientId, campaignId).catch(() => {})
      } catch (error) {
        console.error('Track click error:', error)
      }
    }
  }

  return NextResponse.redirect(targetUrl, 302)
}
