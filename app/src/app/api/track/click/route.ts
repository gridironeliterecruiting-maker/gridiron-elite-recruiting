import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

        // Skip clicks within 15 seconds of send (scanner prefetch)
        const { data: recipient } = await admin
          .from('campaign_recipients')
          .select('sent_at')
          .eq('id', recipientId)
          .single()

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
      } catch (error) {
        console.error('Track click error:', error)
      }
    }
  }

  return NextResponse.redirect(targetUrl, 302)
}
