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

    // Get all recipients
    const { data: recipients } = await supabase
      .from('campaign_recipients')
      .select('id, coach_name, coach_email, status, program_id')
      .eq('campaign_id', id)
      .order('created_at', { ascending: false })

    // Get programs for recipients
    const programIds = [...new Set(recipients?.map((r: any) => r.program_id).filter(Boolean) || [])]
    const { data: programs } = await supabase
      .from('programs')
      .select('id, school_name')
      .in('id', programIds)
    
    const programMap = new Map(programs?.map((p: any) => [p.id, p.school_name]) || [])

    // Get email events for this campaign
    const { data: events } = await supabase
      .from('email_events')
      .select('recipient_id, event_type, created_at')
      .eq('campaign_id', id)

    // Create event lookup map
    const eventsByRecipient = new Map<string, any[]>()
    events?.forEach((event: any) => {
      if (!eventsByRecipient.has(event.recipient_id)) {
        eventsByRecipient.set(event.recipient_id, [])
      }
      eventsByRecipient.get(event.recipient_id)?.push(event)
    })

    // Group recipients by program
    const programsWithRecipients: Record<string, any> = {}
    recipients?.forEach((r: any) => {
      const programName = programMap.get(r.program_id) || 'Unknown Program'
      if (!programsWithRecipients[r.program_id]) {
        programsWithRecipients[r.program_id] = {
          program_name: programName,
          coaches: []
        }
      }

      // Get event timestamps for this recipient
      let sent_at: string | null = null
      let opened_at: string | null = null
      let replied_at: string | null = null
      
      const recipientEvents = eventsByRecipient.get(r.id) || []
      recipientEvents.forEach((event: any) => {
        if (event.event_type === 'sent' && (!sent_at || new Date(event.created_at) < new Date(sent_at))) {
          sent_at = event.created_at
        }
        if (event.event_type === 'opened' && (!opened_at || new Date(event.created_at) < new Date(opened_at))) {
          opened_at = event.created_at
        }
        if (event.event_type === 'replied' && (!replied_at || new Date(event.created_at) < new Date(replied_at))) {
          replied_at = event.created_at
        }
      })

      programsWithRecipients[r.program_id].coaches.push({
        id: r.id,
        coach_name: r.coach_name,
        coach_email: r.coach_email,
        status: r.status,
        sent_at,
        opened_at,
        replied_at
      })
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
      programsWithRecipients: Object.values(programsWithRecipients),
    })
  } catch (error) {
    console.error('Campaign details error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}