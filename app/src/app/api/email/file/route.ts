import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { recipientId } = body as { recipientId: string }

  if (!recipientId) {
    return NextResponse.json({ error: 'recipientId is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Load recipient and verify ownership
  const { data: recipient } = await admin
    .from('campaign_recipients')
    .select(`
      id,
      campaign_id,
      coach_id,
      campaigns!inner(user_id)
    `)
    .eq('id', recipientId)
    .maybeSingle()

  if (!recipient || (recipient as any).campaigns?.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Look up program_id for this coach
  let filedProgramId: string | null = null
  let filedCoachId = recipient.coach_id || null

  if (recipient.coach_id) {
    const { data: coach } = await admin
      .from('coaches')
      .select('id, program_id')
      .eq('id', recipient.coach_id)
      .maybeSingle()

    if (coach) {
      filedProgramId = coach.program_id
    }
  }

  // File it
  const { data: updated, error } = await admin
    .from('campaign_recipients')
    .update({
      filed_at: new Date().toISOString(),
      filed_program_id: filedProgramId,
      filed_coach_id: filedCoachId,
      is_read: true, // filing marks as read
    })
    .eq('id', recipientId)
    .select()
    .single()

  if (error) {
    console.error('[email/file] DB error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, recipient: updated })
}
