import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('type', 'dm')
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Fetch recipients
    const { data: recipients, error: recipientError } = await supabase
      .from('campaign_recipients')
      .select('id, coach_id, coach_name, coach_email, program_name, twitter_handle, status, dm_sent_at')
      .eq('campaign_id', id)
      .order('program_name')

    if (recipientError) {
      return NextResponse.json({ error: 'Failed to fetch recipients' }, { status: 500 })
    }

    // Fetch athlete profile for merge tags
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name, position, grad_year, hudl_url, high_school, city, state, gpa, phone, email')
      .eq('id', user.id)
      .single()

    const total = recipients?.length || 0
    const sent = recipients?.filter(r => r.dm_sent_at !== null).length || 0

    return NextResponse.json({
      campaign,
      recipients: recipients || [],
      profile,
      stats: { total, sent, pending: total - sent },
    })
  } catch (error) {
    console.error('DM campaign details error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
