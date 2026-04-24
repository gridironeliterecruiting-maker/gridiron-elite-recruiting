import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

    // Single source of truth for opens/clicks — see campaign_clean_stats view in DB.
    // Excludes scanner-flagged events. NEVER query email_events directly for stats.
    const { data: cleanStats } = await supabase
      .from('campaign_clean_stats')
      .select('unique_opens, unique_clickers')
      .eq('campaign_id', id)
      .single()

    const stats = {
      total: recipients?.length || 0,
      pending: recipients?.filter(r => r.status === 'pending').length || 0,
      scheduled: recipients?.filter(r => r.status === 'scheduled').length || 0,
      sent: recipients?.filter(r => r.status === 'sent').length || 0,
      replied: recipients?.filter(r => r.status === 'replied').length || 0,
      bounced: recipients?.filter(r => r.status === 'bounced').length || 0,
      opened: cleanStats?.unique_opens || 0,
      clicked: cleanStats?.unique_clickers || 0,
    }

    return NextResponse.json({ campaign, emails, recipients, stats })
  } catch (error) {
    console.error('Get campaign error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
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

    // Only allow deleting drafts
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, status')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (campaign.status !== 'draft') {
      return NextResponse.json({ error: 'Only drafts can be deleted' }, { status: 400 })
    }

    // Delete recipients, emails, then campaign
    await supabase.from('campaign_recipients').delete().eq('campaign_id', id)
    await supabase.from('campaign_emails').delete().eq('campaign_id', id)
    await supabase.from('campaigns').delete().eq('id', id).eq('user_id', user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete campaign error:', error)
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

    const body = await request.json()
    const { status, name } = body

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json({ error: 'Invalid name' }, { status: 400 })
      }
      update.name = name.trim()
    }

    if (status !== undefined) {
      if (!['paused', 'cancelled', 'active'].includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      }
      update.status = status
    }

    if (Object.keys(update).length <= 1) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const { error } = await supabase
      .from('campaigns')
      .update(update)
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 })
    }

    // If pausing, update all scheduled recipients to pending and cancel the pg_cron job
    if (status === 'paused') {
      await supabase
        .from('campaign_recipients')
        .update({ status: 'pending', next_send_at: null })
        .eq('campaign_id', id)
        .eq('status', 'scheduled')

      const admin = createAdminClient()
      await admin.rpc('unschedule_campaign_send', { p_campaign_id: id })
    }

    // If cancelling, update all non-final recipients and cancel the pg_cron job
    if (status === 'cancelled') {
      await supabase
        .from('campaign_recipients')
        .update({ status: 'pending', next_send_at: null })
        .eq('campaign_id', id)
        .in('status', ['pending', 'scheduled'])

      const admin = createAdminClient()
      await admin.rpc('unschedule_campaign_send', { p_campaign_id: id })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update campaign error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
