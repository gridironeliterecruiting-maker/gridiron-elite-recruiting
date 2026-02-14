import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// 1x1 transparent GIF
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const recipientId = searchParams.get('rid')
  const campaignId = searchParams.get('cid')

  if (recipientId && campaignId) {
    try {
      const admin = createAdminClient()
      await admin.from('email_events').insert({
        campaign_id: campaignId,
        recipient_id: recipientId,
        event_type: 'opened',
        metadata: {
          user_agent: request.headers.get('user-agent') || '',
          timestamp: new Date().toISOString(),
        },
      })
    } catch (error) {
      console.error('Track open error:', error)
    }
  }

  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': PIXEL.length.toString(),
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  })
}
