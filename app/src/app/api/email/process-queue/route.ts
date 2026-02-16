import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  refreshGmailToken,
  sendGmailEmail,
  resolveEmailMergeTags,
  addTrackingPixel,
  wrapLinksForTracking,
  addUnsubscribeFooter,
  getTierLimits,
  getAccountTier,
} from '@/lib/gmail'

/**
 * Process the email send queue.
 * Called by Vercel Cron or external cron.
 * Uses admin client to bypass RLS.
 */
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  try {
    // ============================================================
    // SAFETY CHECK 1: Global kill switch
    // ============================================================
    const { data: killSwitch } = await admin
      .from('system_settings')
      .select('value')
      .eq('key', 'email_sending_enabled')
      .single()

    if (!killSwitch || killSwitch.value !== 'true') {
      return NextResponse.json({ 
        processed: 0, 
        message: 'EMAIL SENDING IS DISABLED. Set system_settings.email_sending_enabled = true to enable.',
        safety: 'kill_switch_off'
      })
    }

    // Find all recipients due for sending
    const { data: dueRecipients, error: fetchError } = await admin
      .from('campaign_recipients')
      .select(`
        id,
        campaign_id,
        coach_name,
        coach_email,
        program_name,
        current_step,
        campaigns!inner (
          id,
          user_id,
          name,
          goal,
          status
        )
      `)
      .eq('status', 'scheduled')
      .lte('next_send_at', now)
      .limit(50)

    if (fetchError) {
      console.error('Failed to fetch due recipients:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch queue' }, { status: 500 })
    }

    if (!dueRecipients || dueRecipients.length === 0) {
      return NextResponse.json({ processed: 0, message: 'No emails due' })
    }

    // Group by user for rate limiting
    const byUser: Record<string, typeof dueRecipients> = {}
    for (const r of dueRecipients) {
      const campaign = r.campaigns as unknown as { user_id: string; status: string }
      if (campaign.status !== 'active') continue
      const userId = campaign.user_id
      if (!byUser[userId]) byUser[userId] = []
      byUser[userId].push(r)
    }

    let totalSent = 0
    let totalErrors = 0

    for (const [userId, recipients] of Object.entries(byUser)) {
      // ============================================================
      // SAFETY CHECK 3: Per-user email sending permission
      // Even if a campaign somehow got to 'active' status,
      // the queue processor will NOT send for unapproved users.
      // This is the FINAL gate before any email leaves the system.
      // DO NOT REMOVE without Paul's explicit OK.
      // ============================================================
      const { data: userProfile } = await admin
        .from('profiles')
        .select('can_send_emails, email')
        .eq('id', userId)
        .single()

      if (!userProfile?.can_send_emails) {
        console.log(`BLOCKED: User ${userId} does not have can_send_emails permission. Skipping ALL their emails.`)
        for (const r of recipients) {
          await admin.from('campaign_recipients').update({ status: 'error', updated_at: new Date().toISOString() }).eq('id', r.id)
          await admin.from('email_events').insert({
            campaign_id: r.campaign_id,
            recipient_id: r.id,
            event_type: 'bounced',
            metadata: { reason: 'user_not_approved_to_send', user_id: userId },
          })
        }
        totalErrors += recipients.length
        continue
      }

      // Get user's Gmail token
      const { data: gmailToken } = await admin
        .from('gmail_tokens')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (!gmailToken) {
        console.error(`No Gmail token for user ${userId}`)
        // Mark recipients as error
        for (const r of recipients) {
          await admin.from('campaign_recipients').update({ status: 'error' }).eq('id', r.id)
        }
        totalErrors += recipients.length
        continue
      }

      // Check rate limits
      const { data: recentSends } = await admin
        .from('email_send_log')
        .select('sent_at')
        .eq('user_id', userId)
        .gte('sent_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

      // Update account tier
      const totalSendCount = recentSends?.length || 0
      const newTier = getAccountTier(gmailToken.connected_at, totalSendCount)
      if (newTier !== gmailToken.account_tier) {
        await admin.from('gmail_tokens').update({ account_tier: newTier }).eq('id', gmailToken.id)
      }

      const limits = getTierLimits(newTier)
      const sentToday = recentSends?.length || 0

      if (sentToday >= limits.daily) {
        console.log(`User ${userId} has reached daily limit (${limits.daily})`)
        continue
      }

      // Refresh token if expired
      let accessToken = gmailToken.access_token
      const tokenExpiry = new Date(gmailToken.token_expiry)
      if (tokenExpiry <= new Date()) {
        try {
          const refreshed = await refreshGmailToken(gmailToken.refresh_token)
          accessToken = refreshed.access_token
          const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000)
          await admin
            .from('gmail_tokens')
            .update({
              access_token: accessToken,
              token_expiry: newExpiry.toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', gmailToken.id)
        } catch (error) {
          console.error(`Failed to refresh token for user ${userId}:`, error)
          continue
        }
      }

      // Get user profile for merge tags
      const { data: profile } = await admin
        .from('profiles')
        .select('first_name, last_name, position, grad_year, high_school, city, state, gpa, hudl_url, phone')
        .eq('id', userId)
        .single()

      const remainingToday = limits.daily - sentToday

      for (let i = 0; i < Math.min(recipients.length, remainingToday); i++) {
        const recipient = recipients[i]
        const campaign = recipient.campaigns as unknown as { id: string; name: string; goal: string }

        // Mark as sending
        await admin
          .from('campaign_recipients')
          .update({ status: 'sending' })
          .eq('id', recipient.id)

        try {
          // ============================================================
          // SAFETY CHECK 2: Email allowlist
          // Only send to explicitly approved email addresses
          // ============================================================
          const { data: allowed } = await admin
            .from('email_allowlist')
            .select('id')
            .eq('email', recipient.coach_email)
            .single()

          if (!allowed) {
            console.log(`BLOCKED: ${recipient.coach_email} is NOT on the allowlist. Skipping.`)
            await admin
              .from('campaign_recipients')
              .update({ status: 'error', updated_at: new Date().toISOString() })
              .eq('id', recipient.id)
            await admin.from('email_events').insert({
              campaign_id: recipient.campaign_id,
              recipient_id: recipient.id,
              event_type: 'bounced',
              metadata: { reason: 'not_on_allowlist', email: recipient.coach_email },
            })
            totalErrors++
            continue
          }

          // Check unsubscribe list
          const { data: unsub } = await admin
            .from('unsubscribes')
            .select('id')
            .eq('email', recipient.coach_email)
            .single()

          if (unsub) {
            await admin
              .from('campaign_recipients')
              .update({ status: 'unsubscribed', updated_at: new Date().toISOString() })
              .eq('id', recipient.id)
            continue
          }

          // Get the email template for current step
          const { data: emailTemplate } = await admin
            .from('campaign_emails')
            .select('*')
            .eq('campaign_id', recipient.campaign_id)
            .eq('step_number', recipient.current_step)
            .single()

          if (!emailTemplate) {
            console.error(`No template for campaign ${recipient.campaign_id} step ${recipient.current_step}`)
            await admin
              .from('campaign_recipients')
              .update({ status: 'error' })
              .eq('id', recipient.id)
            totalErrors++
            continue
          }

          // Prepare merge data - keys must match template tags (spaces converted to underscores)
          const mergeData: Record<string, string> = {
            // Coach/School info
            Coach_Name: recipient.coach_name || 'Coach',
            Last_Name: recipient.coach_name?.split(' ').pop() || 'Coach', // Extract coach last name
            School: recipient.program_name || '',
            School_Name: recipient.program_name || '',
            
            // Player info
            First_Name: profile?.first_name || '',
            Last_Name: profile?.last_name || '',
            Position: profile?.position || '',
            Grad_Year: profile?.grad_year?.toString() || '',
            High_School: profile?.high_school || '',
            City: profile?.city || '',
            State: profile?.state || '',
            City_State: [profile?.city, profile?.state].filter(Boolean).join(', '),
            
            // Stats and contact
            GPA: profile?.gpa?.toString() || '',
            Film_Link: profile?.hudl_url || '',
            Hudl_URL: profile?.hudl_url || '',
            // Generate basic stats format based on position
            Stats: profile?.position === 'QB' ? 
              `• ${profile?.grad_year || 'Senior'} QB\n• GPA: ${profile?.gpa || 'N/A'}\n• Height: 6'2" Weight: 195 lbs` : 
              `• ${profile?.grad_year || 'Senior'} ${profile?.position || 'Player'}\n• GPA: ${profile?.gpa || 'N/A'}`,
            Phone: profile?.phone || '',
            Email: userProfile?.email || '',
            
            // Additional useful fields
            Recent_Achievement: '', // TODO: Add achievements
            Improvement_Area: '', // TODO: Add improvement tracking
            Recent_Game_Event: '', // TODO: Add recent games
            Recent_Performance: '', // TODO: Add performance tracking
            Specific_Reason: '', // TODO: Add school-specific interests
            All_Contact_Info: [userProfile?.email, profile?.phone].filter(Boolean).join(' • '),
          }

          // Resolve merge tags
          const subject = resolveEmailMergeTags(emailTemplate.subject, mergeData)
          let body = resolveEmailMergeTags(emailTemplate.body, mergeData)

          // Convert plain text body to HTML
          let htmlBody = body
            .split('\n')
            .map((line: string) => (line.trim() === '' ? '<br>' : `<p style="margin:0 0 8px 0;">${line}</p>`))
            .join('\n')

          // Add tracking
          // Unsubscribe footer removed — these are personal recruiting emails, not marketing
          htmlBody = wrapLinksForTracking(htmlBody, recipient.id, recipient.campaign_id)
          htmlBody = addTrackingPixel(htmlBody, recipient.id, recipient.campaign_id)

          // Wrap in basic HTML email template
          htmlBody = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#333;">${htmlBody}</body></html>`

          // Send via Gmail
          const result = await sendGmailEmail(
            accessToken,
            recipient.coach_email,
            subject,
            htmlBody,
            profile ? `${profile.first_name} ${profile.last_name}` : undefined,
            gmailToken.email
          )

          // Log the send
          await admin.from('email_send_log').insert({
            user_id: userId,
            campaign_id: recipient.campaign_id,
            recipient_email: recipient.coach_email,
            gmail_message_id: result.id,
          })

          // Log sent event
          await admin.from('email_events').insert({
            campaign_id: recipient.campaign_id,
            recipient_id: recipient.id,
            event_type: 'sent',
            metadata: { gmail_message_id: result.id, step: recipient.current_step },
          })

          // Check if there's a next step
          const { data: nextTemplate } = await admin
            .from('campaign_emails')
            .select('step_number, delay_days')
            .eq('campaign_id', recipient.campaign_id)
            .eq('step_number', recipient.current_step + 1)
            .single()

          if (nextTemplate) {
            // Schedule next step
            const nextSendAt = new Date()
            nextSendAt.setDate(nextSendAt.getDate() + (nextTemplate.delay_days || 1))
            // Set to a reasonable hour (9 AM + random offset)
            nextSendAt.setHours(9 + Math.floor(Math.random() * 3), Math.floor(Math.random() * 60), 0, 0)

            await admin
              .from('campaign_recipients')
              .update({
                status: 'scheduled',
                current_step: recipient.current_step + 1,
                next_send_at: nextSendAt.toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', recipient.id)
          } else {
            // Sequence complete
            await admin
              .from('campaign_recipients')
              .update({
                status: 'sent',
                updated_at: new Date().toISOString(),
              })
              .eq('id', recipient.id)
          }

          totalSent++
        } catch (error) {
          console.error(`Failed to send to ${recipient.coach_email}:`, error)
          await admin
            .from('campaign_recipients')
            .update({ status: 'error', updated_at: new Date().toISOString() })
            .eq('id', recipient.id)
          totalErrors++
        }
      }
    }

    // Check for completed campaigns
    const campaignIds = [...new Set(dueRecipients.map(r => r.campaign_id))]
    for (const campaignId of campaignIds) {
      const { data: remaining } = await admin
        .from('campaign_recipients')
        .select('id')
        .eq('campaign_id', campaignId)
        .in('status', ['pending', 'scheduled', 'sending'])

      if (!remaining || remaining.length === 0) {
        await admin
          .from('campaigns')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq('id', campaignId)
      }
    }

    return NextResponse.json({
      processed: totalSent + totalErrors,
      sent: totalSent,
      errors: totalErrors,
    })
  } catch (error) {
    console.error('Process queue error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
