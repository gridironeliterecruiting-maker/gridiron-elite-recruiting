import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Get campaign emails
    const { data: emails } = await supabase
      .from('campaign_emails')
      .select('id, step_number, subject, send_after_days')
      .eq('campaign_id', id)
      .order('step_number')

    // Get all recipients with their latest status
    const { data: recipients } = await supabase
      .from('campaign_recipients')
      .select(`
        id,
        coach_name,
        coach_email,
        status,
        programs!inner(school_name)
      `)
      .eq('campaign_id', id)
      .order('created_at', { ascending: false })
      .limit(20)

    // Get email events for this campaign
    const { data: events } = await supabase
      .from('email_events')
      .select('recipient_id, event_type, created_at')
      .eq('campaign_id', id)

    // Process recipients and events to get detailed info
    const recipientMap = new Map()
    recipients?.forEach(r => {
      recipientMap.set(r.id, {
        id: r.id,
        coach_name: r.coach_name,
        coach_email: r.coach_email,
        program_name: r.programs.school_name,
        status: r.status,
        sent_at: null,
        opened_at: null,
        replied_at: null,
      })
    })

    // Update recipient info based on events
    events?.forEach(event => {
      const recipient = recipientMap.get(event.recipient_id)
      if (recipient) {
        if (event.event_type === 'sent' && !recipient.sent_at) {
          recipient.sent_at = event.created_at
        } else if (event.event_type === 'opened' && !recipient.opened_at) {
          recipient.opened_at = event.created_at
        } else if (event.event_type === 'replied' && !recipient.replied_at) {
          recipient.replied_at = event.created_at
        }
      }
    })

    // Calculate stats from events
    const stats = {
      total: 0,
      sent: 0,
      opened: 0,
      replied: 0,
      error: 0,
    }

    // Get total recipients count
    const { count: totalCount } = await supabase
      .from('campaign_recipients')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', id)

    stats.total = totalCount || 0

    // Count events by type
    const eventCounts = events?.reduce((acc, event) => {
      const key = event.event_type as keyof typeof stats
      if (key in acc) {
        // Count unique recipients per event type
        if (!acc[`${key}_recipients`]) {
          acc[`${key}_recipients`] = new Set()
        }
        acc[`${key}_recipients`].add(event.recipient_id)
      }
      return acc
    }, {} as any) || {}

    // Update stats with unique recipient counts
    if (eventCounts.sent_recipients) {
      stats.sent = eventCounts.sent_recipients.size
    }
    if (eventCounts.opened_recipients) {
      stats.opened = eventCounts.opened_recipients.size
    }
    if (eventCounts.replied_recipients) {
      stats.replied = eventCounts.replied_recipients.size
    }
    if (eventCounts.error_recipients) {
      stats.error = eventCounts.error_recipients.size
    }

    // Also count recipients with 'sent' status if no events
    if (stats.sent === 0) {
      const { count: sentCount } = await supabase
        .from('campaign_recipients')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', id)
        .eq('status', 'sent')
      
      stats.sent = sentCount || 0
    }

    return NextResponse.json({
      ...campaign,
      stats,
      emails: emails || [],
      recipients: Array.from(recipientMap.values()),
    })
  } catch (error) {
    console.error('Campaign details error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}