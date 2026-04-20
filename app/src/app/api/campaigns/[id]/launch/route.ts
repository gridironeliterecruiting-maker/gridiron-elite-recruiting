import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateSendSchedule } from '@/lib/gmail'
import { getAppUrl } from '@/lib/app-url'

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

    // ============================================================
    // SAFETY CHECK: Per-user email sending permission
    // Only users with can_send_emails = true can launch campaigns.
    // This is the PRIMARY gate. DO NOT REMOVE without Paul's explicit OK.
    // ============================================================
    const { data: profile } = await supabase
      .from('profiles')
      .select('can_send_emails, zoho_account_key')
      .eq('id', user.id)
      .single()

    if (!profile?.can_send_emails) {
      return NextResponse.json({
        error: 'Email sending is not enabled for your account. Contact support to get approved.',
        safety: 'user_not_approved'
      }, { status: 403 })
    }

    // Zoho users don't need Gmail — skip Gmail check if zoho_account_key is set
    if (!profile.zoho_account_key) {
      const { data: gmailToken } = await supabase
        .from('gmail_tokens')
        .select('token_expiry')
        .eq('user_id', user.id)
        .single()

      if (!gmailToken) {
        return NextResponse.json({ error: 'Gmail not connected. Please connect your Gmail account first.' }, { status: 400 })
      }
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

    const schedule = calculateSendSchedule(recipients.length, launchTime)

    // Batch update all recipients in one query using upsert
    const updates = recipients.map((r, i) => ({
      id: r.id,
      campaign_id: id,
      status: 'scheduled' as const,
      next_send_at: schedule[i].toISOString(),
      updated_at: new Date().toISOString(),
    }))

    await supabase
      .from('campaign_recipients')
      .upsert(updates, { onConflict: 'id' })

    // Activate campaign
    await supabase
      .from('campaigns')
      .update({
        status: 'active',
        scheduled_at: launchTime?.toISOString() || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    // Trigger email processing
    if (!launchTime || launchTime <= new Date()) {
      // Send now — trigger immediately
      const processUrl = `${getAppUrl()}/api/email/process-queue`
      await fetch(processUrl, {
        headers: { 'Authorization': `Bearer ${process.env.CRON_SECRET}` },
      }).catch(err => console.error('Error triggering email queue:', err))
    } else {
      // Future send — schedule a one-time pg_cron job to fire at the exact time
      const admin = createAdminClient()
      await admin.rpc('schedule_campaign_send', {
        p_campaign_id: id,
        p_send_at: launchTime.toISOString(),
      })
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
