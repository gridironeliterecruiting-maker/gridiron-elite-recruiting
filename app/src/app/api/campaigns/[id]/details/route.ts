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

    // Get all recipients (include coach_id)
    const { data: recipients, error: recipientsError } = await supabase
      .from('campaign_recipients')
      .select('id, coach_id, coach_name, coach_email, status, program_name')
      .eq('campaign_id', id)
      .order('created_at', { ascending: false })

    if (recipientsError) {
      console.error('Error fetching recipients:', recipientsError)
      return NextResponse.json({ error: 'Failed to fetch recipients' }, { status: 500 })
    }

    // Get email events for this campaign (include clicked)
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

    // Get unique program names to look up logos
    const programNames = [...new Set((recipients || []).map(r => r.program_name).filter(Boolean))]

    // Fetch program data (id + logo_url) by school_name
    let programDataMap: Record<string, { program_id: string; logo_url: string | null }> = {}
    if (programNames.length > 0) {
      const { data: programRows } = await supabase
        .from('programs')
        .select('id, school_name, logo_url')
        .in('school_name', programNames)

      if (programRows) {
        for (const p of programRows) {
          programDataMap[p.school_name] = { program_id: p.id, logo_url: p.logo_url }
        }
      }
    }

    // Group recipients by program
    const programsWithRecipients: Record<string, any> = {}
    recipients?.forEach((r: any) => {
      const programName = r.program_name || 'Unknown Program'
      if (!programsWithRecipients[programName]) {
        const pData = programDataMap[programName]
        programsWithRecipients[programName] = {
          program_name: programName,
          program_id: pData?.program_id || null,
          logo_url: pData?.logo_url || null,
          coaches: []
        }
      }

      // Get event timestamps for this recipient
      let sent_at: string | null = null
      let opened_at: string | null = null
      let clicked_at: string | null = null
      let replied_at: string | null = null

      const recipientEvents = eventsByRecipient.get(r.id) || []
      recipientEvents.forEach((event: any) => {
        if (event.event_type === 'sent' && (!sent_at || new Date(event.created_at) < new Date(sent_at))) {
          sent_at = event.created_at
        }
        if (event.event_type === 'opened' && (!opened_at || new Date(event.created_at) < new Date(opened_at))) {
          opened_at = event.created_at
        }
        if (event.event_type === 'clicked' && (!clicked_at || new Date(event.created_at) < new Date(clicked_at))) {
          clicked_at = event.created_at
        }
        if (event.event_type === 'replied' && (!replied_at || new Date(event.created_at) < new Date(replied_at))) {
          replied_at = event.created_at
        }
      })

      programsWithRecipients[programName].coaches.push({
        id: r.id,
        coach_id: r.coach_id,
        coach_name: r.coach_name,
        coach_email: r.coach_email,
        status: r.status,
        sent_at,
        opened_at,
        clicked_at,
        replied_at
      })
    })

    // Calculate stats from events
    const stats = {
      total: 0,
      sent: 0,
      opened: 0,
      clicked: 0,
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
      const key = event.event_type as string
      if (['sent', 'opened', 'clicked', 'replied', 'error'].includes(key)) {
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
    if (eventCounts.clicked_recipients) {
      stats.clicked = eventCounts.clicked_recipients.size
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
