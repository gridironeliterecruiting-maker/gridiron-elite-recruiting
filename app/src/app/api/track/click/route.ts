import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const recipientId = searchParams.get('rid')
  const campaignId = searchParams.get('cid')
  const targetUrl = searchParams.get('url')

  if (!targetUrl) {
    return NextResponse.json({ error: 'Missing URL' }, { status: 400 })
  }

  if (recipientId && campaignId) {
    try {
      const admin = createAdminClient()
      await admin.from('email_events').insert({
        campaign_id: campaignId,
        recipient_id: recipientId,
        event_type: 'clicked',
        metadata: {
          url: targetUrl,
          user_agent: request.headers.get('user-agent') || '',
          timestamp: new Date().toISOString(),
        },
      })
    } catch (error) {
      console.error('Track click error:', error)
    }
  }

  return NextResponse.redirect(targetUrl, 302)
}
