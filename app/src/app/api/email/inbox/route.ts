import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Get all campaigns belonging to this user
  const { data: campaigns } = await admin
    .from('campaigns')
    .select('id')
    .eq('user_id', user.id)

  if (!campaigns || campaigns.length === 0) {
    return NextResponse.json({ items: [], unreadCount: 0 })
  }

  const campaignIds = campaigns.map((c: { id: string }) => c.id)

  // Fetch replied recipients that haven't been filed
  const { data: recipients, error } = await admin
    .from('campaign_recipients')
    .select(`
      id,
      campaign_id,
      coach_id,
      coach_name,
      coach_email,
      program_name,
      status,
      replied_at,
      is_read,
      filed_at
    `)
    .in('campaign_id', campaignIds)
    .eq('status', 'replied')
    .is('filed_at', null)
    .order('replied_at', { ascending: false })

  if (error) {
    console.error('[email/inbox] DB error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  // Fetch email_events for snippets and subjects
  const recipientIds = (recipients || []).map((r: { id: string }) => r.id)

  let eventsByRecipient: Record<string, { subject?: string; snippet?: string }> = {}
  if (recipientIds.length > 0) {
    const { data: events } = await admin
      .from('email_events')
      .select('recipient_id, event_type, metadata, created_at')
      .in('recipient_id', recipientIds)
      .eq('event_type', 'replied')
      .order('created_at', { ascending: false })

    if (events) {
      for (const ev of events) {
        if (!eventsByRecipient[ev.recipient_id]) {
          eventsByRecipient[ev.recipient_id] = {
            subject: ev.metadata?.subject,
            snippet: ev.metadata?.snippet,
          }
        }
      }
    }
  }

  // Fetch program data for division/conference
  const coachIds = [...new Set((recipients || []).map((r: { coach_id: string }) => r.coach_id).filter(Boolean))]
  let programByCoach: Record<string, { division: string; conference: string; school_name: string; id: string }> = {}

  if (coachIds.length > 0) {
    const { data: coaches } = await admin
      .from('coaches')
      .select('id, program_id, programs(id, school_name, division, conference)')
      .in('id', coachIds)

    if (coaches) {
      for (const coach of coaches) {
        const prog = (coach as any).programs
        if (prog) {
          programByCoach[coach.id] = {
            id: prog.id,
            school_name: prog.school_name,
            division: prog.division,
            conference: prog.conference,
          }
        }
      }
    }
  }

  const items = (recipients || []).map((r: any) => ({
    id: r.id,
    campaign_id: r.campaign_id,
    coach_id: r.coach_id,
    coach_name: r.coach_name,
    coach_email: r.coach_email,
    program_name: r.program_name,
    replied_at: r.replied_at,
    is_read: r.is_read,
    subject: eventsByRecipient[r.id]?.subject || '(No subject)',
    snippet: eventsByRecipient[r.id]?.snippet || '',
    program: programByCoach[r.coach_id] || null,
  }))

  const unreadCount = items.filter((i: any) => !i.is_read).length

  return NextResponse.json({ items, unreadCount })
}
