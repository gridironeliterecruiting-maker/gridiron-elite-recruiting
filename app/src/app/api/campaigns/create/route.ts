import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, goal, templates, recipients, scheduledAt, status } = body

    if (!name || !goal || !templates?.length || !recipients?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Create campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .insert({
        user_id: user.id,
        name,
        goal,
        status: status || 'draft',
        scheduled_at: scheduledAt || null,
      })
      .select('id')
      .single()

    if (campaignError || !campaign) {
      console.error('Failed to create campaign:', campaignError)
      return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 })
    }

    // Insert email templates
    const emailInserts = templates.map((t: { subject: string; body: string; delayDays: number | null; name: string }, index: number) => ({
      campaign_id: campaign.id,
      step_number: index + 1,
      subject: t.subject,
      body: t.body,
      delay_days: t.delayDays ?? 0,
    }))

    const { error: emailError } = await supabase
      .from('campaign_emails')
      .insert(emailInserts)

    if (emailError) {
      console.error('Failed to insert campaign emails:', emailError)
      // Clean up
      await supabase.from('campaigns').delete().eq('id', campaign.id)
      return NextResponse.json({ error: 'Failed to create email templates' }, { status: 500 })
    }

    // Insert recipients
    const recipientInserts = recipients.map((r: { coachId: string; coachName: string; email: string; programName: string }) => ({
      campaign_id: campaign.id,
      coach_id: parseInt(r.coachId) || null,
      coach_name: r.coachName,
      coach_email: r.email,
      program_name: r.programName,
      current_step: 1,
      status: 'pending',
    }))

    const { error: recipientError } = await supabase
      .from('campaign_recipients')
      .insert(recipientInserts)

    if (recipientError) {
      console.error('Failed to insert recipients:', recipientError)
      await supabase.from('campaigns').delete().eq('id', campaign.id)
      return NextResponse.json({ error: 'Failed to add recipients' }, { status: 500 })
    }

    return NextResponse.json({ success: true, campaignId: campaign.id })
  } catch (error) {
    console.error('Create campaign error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
