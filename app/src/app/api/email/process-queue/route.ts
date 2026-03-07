import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatGPA } from '@/lib/utils'
import {
  refreshGmailToken,
  sendGmailEmail,
  resolveEmailMergeTags,
  addTrackingPixel,
  wrapLinksForTracking,
  addUnsubscribeFooter,
} from '@/lib/gmail'
import { getWorkspaceGmailAccessToken } from '@/lib/workspace'

/**
 * Process the email send queue.
 * Called by Vercel Cron or external cron.
 * Uses admin client to bypass RLS.
 */
export async function GET(request: Request) {
  // Block email sending on non-production environments (staging/preview)
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
    return NextResponse.json({ processed: 0, message: 'Email sending is disabled in preview/staging environments', safety: 'non_production' })
  }

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
          player_id,
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
        .select('can_send_emails, email, workspace_email, first_name, last_name')
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

      // Determine sending mechanism:
      // - Workspace users: service account impersonation (no per-user token needed)
      // - Grandfathered users: personal Gmail OAuth token (legacy)
      let accessToken: string
      let fromEmail: string

      if (userProfile.workspace_email) {
        // Workspace user — impersonate their @flightschoolmail.com address
        try {
          accessToken = await getWorkspaceGmailAccessToken(userProfile.workspace_email)
          fromEmail = userProfile.workspace_email
        } catch (error) {
          console.error(`Failed to get workspace token for ${userProfile.workspace_email}:`, error)
          for (const r of recipients) {
            await admin.from('campaign_recipients').update({ status: 'error' }).eq('id', r.id)
          }
          totalErrors += recipients.length
          continue
        }
      } else {
        // Grandfathered user — use their personal Gmail OAuth token
        const { data: gmailToken } = await admin
          .from('gmail_tokens')
          .select('*')
          .eq('user_id', userId)
          .single()

        if (!gmailToken) {
          console.error(`No Gmail token for user ${userId}`)
          for (const r of recipients) {
            await admin.from('campaign_recipients').update({ status: 'error' }).eq('id', r.id)
          }
          totalErrors += recipients.length
          continue
        }

        accessToken = gmailToken.access_token
        fromEmail = gmailToken.email
        const tokenExpiry = new Date(gmailToken.token_expiry)

        if (tokenExpiry <= new Date()) {
          try {
            const refreshed = await refreshGmailToken(gmailToken.refresh_token)
            accessToken = refreshed.access_token
            fromEmail = gmailToken.email
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
      }

      // Determine if this user has any coach campaigns (player_id set)
      // If so, we'll resolve merge tags per-recipient from the player's profile
      // For now, fetch the sender's own profile as the default merge tag source
      const { data: senderProfile } = await admin
        .from('profiles')
        .select('first_name, last_name, position, grad_year, high_school, city, state, gpa, hudl_url, phone, email')
        .eq('id', userId)
        .single()

      for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i]
        const campaign = recipient.campaigns as unknown as { id: string; name: string; goal: string; player_id: string | null }

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

          // When player_id is set (coach campaign), use the player's profile for merge tags
          // and the sender's profile for the sender name. Otherwise, sender IS the player.
          let mergeProfile = senderProfile
          if (campaign.player_id) {
            const { data: playerProfile } = await admin
              .from('profiles')
              .select('first_name, last_name, position, grad_year, high_school, city, state, gpa, hudl_url, phone, email')
              .eq('id', campaign.player_id)
              .single()
            if (playerProfile) {
              mergeProfile = playerProfile
            } else {
              console.warn(`Coach campaign ${campaign.id}: could not fetch player ${campaign.player_id} profile, falling back to sender profile`)
            }
          }

          // Build merge data — canonical ((Player ...)) / ((Coach ...)) / ((School Name)) tags
          // plus full backwards compat for old formats
          const coachFirstName = recipient.coach_name?.split(' ')[0] || ''
          const coachLastName = recipient.coach_name?.split(' ').pop() || ''
          const cityState = [mergeProfile?.city, mergeProfile?.state].filter(Boolean).join(', ')
          const playerEmail = (mergeProfile as any)?.email || userProfile?.email || ''

          const profileData: Record<string, string> = {
            // ── Canonical tags (preferred) ────────────────────────────────────
            // Recipient college coach
            'Coach_Last_Name':    coachLastName,
            'Coach_First_Name':   coachFirstName,
            'Coach_Name':         recipient.coach_name || '',
            // College / program
            'School_Name':        recipient.program_name || '',
            // Player being recruited
            'Player_First_Name':  mergeProfile?.first_name || '',
            'Player_Last_Name':   mergeProfile?.last_name || '',
            'Player_Position':    mergeProfile?.position || '',
            'Player_Grad_Year':   mergeProfile?.grad_year?.toString() || '',
            'Player_High_School': mergeProfile?.high_school || '',
            'Player_City':        mergeProfile?.city || '',
            'Player_State':       mergeProfile?.state || '',
            'Player_GPA':         formatGPA(mergeProfile?.gpa),
            'Player_Film_Link':   mergeProfile?.hudl_url || '',
            'Player_Phone':       mergeProfile?.phone || '',
            'Player_Email':       playerEmail,
            // Sender (for coach campaigns — the sending coach's own name)
            'My_First_Name':      senderProfile?.first_name || '',
            'My_Last_Name':       senderProfile?.last_name || '',

            // ── Legacy aliases (backwards compat) ───────────────────────────
            'Last_Name_Coach':    coachLastName,
            'School':             recipient.program_name || '',
            'First_Name':         mergeProfile?.first_name || '',
            'Last_Name':          mergeProfile?.last_name || '',
            'Position':           mergeProfile?.position || '',
            'Grad_Year':          mergeProfile?.grad_year?.toString() || '',
            'High_School':        mergeProfile?.high_school || '',
            'City':               mergeProfile?.city || '',
            'State':              mergeProfile?.state || '',
            'City_State':         cityState,
            'GPA':                formatGPA(mergeProfile?.gpa),
            'Film_Link':          mergeProfile?.hudl_url || '',
            'Hudl_URL':           mergeProfile?.hudl_url || '',
            'Phone':              mergeProfile?.phone || '',
            'Email':              playerEmail,
            'Stats':              mergeProfile?.position
              ? `• Class of ${mergeProfile?.grad_year || ''} ${mergeProfile.position}\n• GPA: ${formatGPA(mergeProfile?.gpa) || 'N/A'}`
              : '',
            'Recent_Achievement': '',
            'Improvement_Area':   '',
            'Recent_Game_Event':  '',
            'Recent_Performance': '',
            'Specific_Reason':    '',
            'All_Contact_Info':   [playerEmail, mergeProfile?.phone].filter(Boolean).join(' • '),
          }

          // Expand every key into all lookup variations the resolver might try
          const mergeData: Record<string, string> = {}
          Object.entries(profileData).forEach(([key, value]) => {
            mergeData[key] = value
            mergeData[key.replace(/_/g, ' ')] = value              // underscores → spaces
            mergeData[key.toLowerCase()] = value                   // all lowercase (underscores)
            mergeData[key.replace(/_/g, ' ').toLowerCase()] = value // all lowercase (spaces)
          })

          // Extra legacy keys for old {{athlete_*}} / {{coach_*}} format
          mergeData['athlete_first_name'] = profileData['Player_First_Name']
          mergeData['athlete_last_name']  = profileData['Player_Last_Name']
          mergeData['coach_first_name']   = profileData['Coach_First_Name']
          mergeData['coach_last_name']    = profileData['Coach_Last_Name']
          mergeData['school_name']        = profileData['School_Name']
          mergeData['hudl_url']           = profileData['Player_Film_Link']
          mergeData['city_state']         = profileData['City_State']

          // Resolve merge tags
          const subject = resolveEmailMergeTags(emailTemplate.subject, mergeData)
          let body = resolveEmailMergeTags(emailTemplate.body, mergeData)

          // ============================================================
          // SAFETY CHECK: Block send if any merge tags remain unresolved.
          // An email with ((Coach Last Name)) or {{field}} still visible
          // would be deeply unprofessional and must never leave the system.
          // ============================================================
          const unresolvedPattern = /\(\([^)]+\)\)|\{\{[^}]+\}\}/
          if (unresolvedPattern.test(subject) || unresolvedPattern.test(body)) {
            console.error(`BLOCKED: Unresolved merge tags for recipient ${recipient.id} (campaign ${recipient.campaign_id} step ${recipient.current_step})`)
            await admin
              .from('campaign_recipients')
              .update({ status: 'error', updated_at: new Date().toISOString() })
              .eq('id', recipient.id)
            await admin.from('email_events').insert({
              campaign_id: recipient.campaign_id,
              recipient_id: recipient.id,
              event_type: 'bounced',
              metadata: { reason: 'unresolved_merge_tags', step: recipient.current_step },
            })
            totalErrors++
            continue
          }

          // Convert plain text body to HTML, auto-linking bare URLs
          let htmlBody = body
            .split('\n')
            .map((line: string) => {
              if (line.trim() === '') return '<br>'
              const linked = line.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1">$1</a>')
              return `<p style="margin:0 0 8px 0;">${linked}</p>`
            })
            .join('\n')

          // Add tracking
          // Unsubscribe footer removed — these are personal recruiting emails, not marketing
          htmlBody = wrapLinksForTracking(htmlBody, recipient.id, recipient.campaign_id)
          htmlBody = addTrackingPixel(htmlBody, recipient.id, recipient.campaign_id)

          // Wrap in basic HTML email template
          htmlBody = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#333;">${htmlBody}</body></html>`

          // Send via Gmail — for coach campaigns, use player name as sender display name
          const senderDisplayName = mergeProfile
            ? `${mergeProfile.first_name} ${mergeProfile.last_name}`
            : (senderProfile ? `${senderProfile.first_name} ${senderProfile.last_name}` : undefined)

          const result = await sendGmailEmail(
            accessToken,
            recipient.coach_email,
            subject,
            htmlBody,
            senderDisplayName,
            fromEmail
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
