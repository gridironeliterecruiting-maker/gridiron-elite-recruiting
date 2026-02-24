import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    const { recipientId, sent } = await request.json()

    if (!recipientId) {
      return NextResponse.json({ error: 'Missing recipientId' }, { status: 400 })
    }

    // Verify campaign belongs to user
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .single()

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Update recipient
    const now = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('campaign_recipients')
      .update({
        dm_sent_at: sent ? now : null,
        status: sent ? 'sent' : 'pending',
        updated_at: now,
      })
      .eq('id', recipientId)
      .eq('campaign_id', campaignId)

    if (updateError) {
      console.error('Failed to update recipient:', updateError)
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
    }

    // Log interaction if marking as sent
    if (sent) {
      // Get recipient details for logging
      const { data: recipient } = await supabase
        .from('campaign_recipients')
        .select('coach_id, program_name')
        .eq('id', recipientId)
        .single()

      if (recipient?.coach_id) {
        // Find or create pipeline entry for this program
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
              subject: 'X DM',
              occurred_at: now,
            })
          }
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

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Mark DM sent error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
