import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatGPA } from '@/lib/utils'
import {
  sendTwitterDm,
  getTwitterUserByUsername,
  refreshTwitterToken,
} from '@/lib/twitter'
import { resolveMergeTags } from '@/lib/merge-tags'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await params

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { recipientId } = await request.json()

    if (!recipientId) {
      return NextResponse.json({ error: 'Missing recipientId' }, { status: 400 })
    }

    // Verify campaign belongs to user
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, dm_message_body, user_id')
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .single()

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Get recipient
    const { data: recipient } = await supabase
      .from('campaign_recipients')
      .select('*')
      .eq('id', recipientId)
      .eq('campaign_id', campaignId)
      .single()

    if (!recipient) {
      return NextResponse.json({ error: 'Recipient not found' }, { status: 404 })
    }

    if (!recipient.twitter_handle) {
      return NextResponse.json({ error: 'Recipient has no Twitter handle' }, { status: 400 })
    }

    // Get Twitter token
    const admin = createAdminClient()
    const { data: twitterToken } = await admin
      .from('twitter_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!twitterToken) {
      return NextResponse.json({ error: 'Twitter not connected' }, { status: 400 })
    }

    // Refresh token if expired
    let accessToken = twitterToken.access_token
    if (twitterToken.token_expiry && new Date(twitterToken.token_expiry) <= new Date()) {
      if (!twitterToken.refresh_token) {
        return NextResponse.json({ error: 'Twitter token expired — re-authorize required' }, { status: 401 })
      }
      const refreshed = await refreshTwitterToken(twitterToken.refresh_token)
      accessToken = refreshed.access_token
      const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
      await admin
        .from('twitter_tokens')
        .update({
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token || twitterToken.refresh_token,
          token_expiry: newExpiry,
          updated_at: new Date().toISOString(),
        })
        .eq('id', twitterToken.id)
    }

    // Resolve Twitter user ID (cached in campaign_recipients.twitter_user_id)
    let participantId = recipient.twitter_user_id
    if (!participantId) {
      const twitterUser = await getTwitterUserByUsername(accessToken, recipient.twitter_handle)
      if (!twitterUser) {
        return NextResponse.json(
          { error: `Could not find Twitter user @${recipient.twitter_handle}` },
          { status: 404 }
        )
      }
      participantId = twitterUser.id

      // Cache the user ID
      await supabase
        .from('campaign_recipients')
        .update({ twitter_user_id: participantId })
        .eq('id', recipientId)
    }

    // Resolve merge tags in message
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    const message = resolveMergeTags(campaign.dm_message_body || '', {
      coachName: recipient.coach_name,
      schoolName: recipient.program_name,
      playerFirstName: profile?.first_name || '',
      playerLastName: profile?.last_name || '',
      position: profile?.position || '',
      filmLink: profile?.hudl_url || '',
      gradYear: profile?.grad_year?.toString() || '',
      highSchool: profile?.high_school || '',
      city: profile?.city || '',
      state: profile?.state || '',
      gpa: formatGPA(profile?.gpa),
      phone: profile?.phone || '',
      email: profile?.email || '',
    })

    // Send the DM
    const result = await sendTwitterDm(accessToken, participantId, message)

    // Update recipient as sent
    const now = new Date().toISOString()
    await supabase
      .from('campaign_recipients')
      .update({
        dm_sent_at: now,
        status: 'sent',
        updated_at: now,
      })
      .eq('id', recipientId)
      .eq('campaign_id', campaignId)

    // Create pipeline entry + log interaction (same as mark-sent)
    if (recipient.coach_id) {
      const program = await supabase
        .from('programs')
        .select('id')
        .eq('school_name', recipient.program_name)
        .single()

      if (program.data) {
        // Log interaction only if pipeline entry already exists
        const { data: existingEntry } = await supabase
          .from('pipeline_entries')
          .select('id')
          .eq('athlete_id', user.id)
          .eq('program_id', program.data.id)
          .single()

        if (existingEntry) {
          await supabase.from('interactions').insert({
            pipeline_entry_id: existingEntry.id,
            athlete_id: user.id,
            coach_id: recipient.coach_id,
            type: 'dm_sent',
            direction: 'outbound',
            subject: 'X DM (auto-sent)',
            occurred_at: now,
          })
        }
      }
    }

    // Check if all recipients are sent — mark campaign completed
    const { data: pendingRecipients } = await supabase
      .from('campaign_recipients')
      .select('id')
      .eq('campaign_id', campaignId)
      .is('dm_sent_at', null)

    if (!pendingRecipients || pendingRecipients.length === 0) {
      await supabase
        .from('campaigns')
        .update({ status: 'completed', updated_at: now })
        .eq('id', campaignId)
    }

    return NextResponse.json({
      success: true,
      dmConversationId: result.dm_conversation_id,
      dmEventId: result.dm_event_id,
    })
  } catch (error: any) {
    console.error('Send DM error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to send DM' },
      { status: 500 }
    )
  }
}
