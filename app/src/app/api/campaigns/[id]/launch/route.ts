import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateSendSchedule } from '@/lib/gmail'

export async function POST(
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

    // Verify campaign belongs to user and is in draft/paused status
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (!['draft', 'paused'].includes(campaign.status)) {
      return NextResponse.json({ error: 'Campaign cannot be launched from current status' }, { status: 400 })
    }

    // Check if user has Gmail connected
    const { data: gmailToken } = await supabase
      .from('gmail_tokens')
      .select('account_tier, connected_at')
      .eq('user_id', user.id)
      .single()

    if (!gmailToken) {
      return NextResponse.json({ error: 'Gmail not connected. Please connect your Gmail account first.' }, { status: 400 })
    }

    // Get recipients
    const { data: recipients } = await supabase
      .from('campaign_recipients')
      .select('id')
      .eq('campaign_id', id)
      .in('status', ['pending'])

    if (!recipients || recipients.length === 0) {
      return NextResponse.json({ error: 'No pending recipients' }, { status: 400 })
    }

    // Parse optional launch time from request body
    let launchTime: Date | undefined
    try {
      const body = await request.json()
      if (body.scheduledAt) {
        launchTime = new Date(body.scheduledAt)
      }
    } catch {
      // No body or invalid JSON — launch now
    }

    // Calculate send schedule based on tier
    const schedule = calculateSendSchedule(
      recipients.length,
      gmailToken.account_tier || 'new',
      launchTime
    )

    // Update each recipient with their scheduled send time
    const updates = recipients.map((r, i) => ({
      id: r.id,
      status: 'scheduled' as const,
      next_send_at: schedule[i].toISOString(),
      updated_at: new Date().toISOString(),
    }))

    // Batch update recipients
    for (const update of updates) {
      await supabase
        .from('campaign_recipients')
        .update({
          status: update.status,
          next_send_at: update.next_send_at,
          updated_at: update.updated_at,
        })
        .eq('id', update.id)
    }

    // Activate campaign
    await supabase
      .from('campaigns')
      .update({
        status: 'active',
        scheduled_at: launchTime?.toISOString() || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    return NextResponse.json({
      success: true,
      recipientsScheduled: recipients.length,
      firstSendAt: schedule[0]?.toISOString(),
      lastSendAt: schedule[schedule.length - 1]?.toISOString(),
    })
  } catch (error) {
    console.error('Launch campaign error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
