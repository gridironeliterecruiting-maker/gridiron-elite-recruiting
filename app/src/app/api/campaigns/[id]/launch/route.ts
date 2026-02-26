import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateSendSchedule } from '@/lib/gmail'
import { getAppUrl } from '@/lib/app-url'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Block campaign launches on non-production environments (staging/preview)
    if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
      return NextResponse.json({ error: 'Campaign launching is disabled in preview/staging environments' }, { status: 403 })
    }

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

    // ============================================================
    // SAFETY CHECK: Per-user email sending permission
    // Only users with can_send_emails = true can launch campaigns.
    // This is the PRIMARY gate. DO NOT REMOVE without Paul's explicit OK.
    // ============================================================
    const { data: profile } = await supabase
      .from('profiles')
      .select('can_send_emails')
      .eq('id', user.id)
      .single()

    if (!profile?.can_send_emails) {
      return NextResponse.json({ 
        error: 'Email sending is not enabled for your account. Contact support to get approved.',
        safety: 'user_not_approved'
      }, { status: 403 })
    }

    // Check if user has Gmail connected
    const { data: gmailToken } = await supabase
      .from('gmail_tokens')
      .select('account_tier, connected_at, token_expiry')
      .eq('user_id', user.id)
      .single()

    if (!gmailToken) {
      return NextResponse.json({ error: 'Gmail not connected. Please connect your Gmail account first.' }, { status: 400 })
    }
    
    // Don't check token expiry - just let it work
    console.log('[Launch] Gmail token found, proceeding with launch')

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

    // Trigger immediate email processing for "Launch Now" campaigns
    if (!launchTime || launchTime <= new Date()) {
      try {
        const processUrl = `${getAppUrl()}/api/email/process-queue`
        const processRes = await fetch(processUrl, {
          headers: {
            'Authorization': `Bearer ${process.env.CRON_SECRET}`,
          },
        })
        
        if (!processRes.ok) {
          console.error('Failed to trigger email processing:', await processRes.text())
        } else {
          console.log('Email queue processing triggered successfully')
        }
      } catch (processError) {
        // Don't fail the launch if queue processing fails - cron will pick it up later
        console.error('Error triggering email queue:', processError)
      }
    }

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
