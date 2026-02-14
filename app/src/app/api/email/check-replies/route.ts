import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { refreshGmailToken } from '@/lib/gmail'

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1'

/**
 * Check for coach replies to campaign emails.
 * Called by cron every 15 minutes.
 * Uses the simpler approach: for each coach we've emailed,
 * search the user's inbox for messages from that coach.
 */
export async function GET(request: Request) {
  // Verify cron secret (same as process-queue)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  let totalReplies = 0
  const errors: string[] = []

  try {
    // Get all users with active campaigns and gmail tokens
    const { data: activeCampaigns } = await admin
      .from('campaigns')
      .select('id, user_id')
      .eq('status', 'active')

    if (!activeCampaigns || activeCampaigns.length === 0) {
      return NextResponse.json({ replies: 0, message: 'No active campaigns' })
    }

    // Group by user
    const userIds = [...new Set(activeCampaigns.map(c => c.user_id))]

    for (const userId of userIds) {
      try {
        // Get Gmail token
        const { data: gmailToken } = await admin
          .from('gmail_tokens')
          .select('*')
          .eq('user_id', userId)
          .single()

        if (!gmailToken) {
          errors.push(`No Gmail token for user ${userId}`)
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
          } catch (err) {
            errors.push(`Token refresh failed for user ${userId}: ${err}`)
            continue
          }
        }

        // Get campaign IDs for this user
        const userCampaignIds = activeCampaigns
          .filter(c => c.user_id === userId)
          .map(c => c.id)

        // Get recipients with status 'sent' or 'scheduled' (not yet replied)
        const { data: recipients } = await admin
          .from('campaign_recipients')
          .select('id, campaign_id, coach_email, coach_name, status')
          .in('campaign_id', userCampaignIds)
          .in('status', ['sent', 'scheduled', 'sending'])

        if (!recipients || recipients.length === 0) continue

        // Get unique coach emails to check
        const coachEmails = [...new Set(recipients.map(r => r.coach_email))]

        for (const coachEmail of coachEmails) {
          try {
            // Search Gmail for messages from this coach in the last 2 days
            const query = `from:${coachEmail} newer_than:2d`
            const searchUrl = `${GMAIL_API_BASE}/users/me/messages?q=${encodeURIComponent(query)}&maxResults=5`

            const searchRes = await fetch(searchUrl, {
              headers: { Authorization: `Bearer ${accessToken}` },
            })

            if (!searchRes.ok) {
              // If 401, token might have expired mid-run
              if (searchRes.status === 401) {
                errors.push(`Auth expired mid-run for user ${userId}`)
                break
              }
              continue
            }

            const searchData = await searchRes.json()

            if (!searchData.messages || searchData.messages.length === 0) {
              continue
            }

            // Found messages from this coach — get snippet from the first one
            const msgId = searchData.messages[0].id
            const msgRes = await fetch(
              `${GMAIL_API_BASE}/users/me/messages/${msgId}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            )

            let snippet = ''
            let replySubject = ''
            if (msgRes.ok) {
              const msgData = await msgRes.json()
              snippet = msgData.snippet || ''
              const subjectHeader = msgData.payload?.headers?.find(
                (h: { name: string }) => h.name.toLowerCase() === 'subject'
              )
              replySubject = subjectHeader?.value || ''
            }

            // Mark all matching recipients as replied
            const matchingRecipients = recipients.filter(
              r => r.coach_email === coachEmail
            )

            for (const recipient of matchingRecipients) {
              // Check if we already logged a reply for this recipient
              const { data: existingReply } = await admin
                .from('email_events')
                .select('id')
                .eq('recipient_id', recipient.id)
                .eq('event_type', 'replied')
                .limit(1)

              if (existingReply && existingReply.length > 0) {
                continue // Already tracked
              }

              // Update recipient status to replied
              await admin
                .from('campaign_recipients')
                .update({
                  status: 'replied',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', recipient.id)

              // Insert reply event
              await admin.from('email_events').insert({
                campaign_id: recipient.campaign_id,
                recipient_id: recipient.id,
                event_type: 'replied',
                metadata: {
                  coach_email: coachEmail,
                  coach_name: recipient.coach_name,
                  snippet: snippet.slice(0, 500),
                  reply_subject: replySubject,
                  gmail_message_id: msgId,
                  detected_at: new Date().toISOString(),
                },
              })

              totalReplies++
            }
          } catch (err) {
            errors.push(`Error checking ${coachEmail}: ${err}`)
          }

          // Small delay to avoid Gmail API rate limits
          await new Promise(resolve => setTimeout(resolve, 200))
        }
      } catch (err) {
        errors.push(`Error processing user ${userId}: ${err}`)
      }
    }

    return NextResponse.json({
      replies: totalReplies,
      errors: errors.length > 0 ? errors : undefined,
      checked_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Check replies error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
