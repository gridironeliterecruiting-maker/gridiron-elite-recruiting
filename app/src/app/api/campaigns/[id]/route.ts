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

    // Get campaign
    const { data: campaign, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Get emails
    const { data: emails } = await supabase
      .from('campaign_emails')
      .select('*')
      .eq('campaign_id', id)
      .order('step_number')

    // Get recipient stats
    const { data: recipients } = await supabase
      .from('campaign_recipients')
      .select('id, coach_name, coach_email, program_name, status, current_step')
      .eq('campaign_id', id)

    // Get event counts
    const { data: events } = await supabase
      .from('email_events')
      .select('event_type')
      .eq('campaign_id', id)

    const stats = {
      total: recipients?.length || 0,
      pending: recipients?.filter(r => r.status === 'pending').length || 0,
      scheduled: recipients?.filter(r => r.status === 'scheduled').length || 0,
      sent: recipients?.filter(r => r.status === 'sent').length || 0,
      replied: recipients?.filter(r => r.status === 'replied').length || 0,
      bounced: recipients?.filter(r => r.status === 'bounced').length || 0,
      opened: events?.filter(e => e.event_type === 'opened').length || 0,
      clicked: events?.filter(e => e.event_type === 'clicked').length || 0,
    }

    return NextResponse.json({ campaign, emails, recipients, stats })
  } catch (error) {
    console.error('Get campaign error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
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

    const { status } = await request.json()

    if (!['paused', 'cancelled', 'active'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const { error } = await supabase
      .from('campaigns')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 })
    }

    // If pausing, update all scheduled recipients to pending
    if (status === 'paused') {
      await supabase
        .from('campaign_recipients')
        .update({ status: 'pending', next_send_at: null })
        .eq('campaign_id', id)
        .eq('status', 'scheduled')
    }

    // If cancelling, update all non-final recipients
    if (status === 'cancelled') {
      await supabase
        .from('campaign_recipients')
        .update({ status: 'pending', next_send_at: null })
        .eq('campaign_id', id)
        .in('status', ['pending', 'scheduled'])
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update campaign error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
