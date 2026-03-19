import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const { slug, code } = await request.json()

    if (!slug || !code) {
      return NextResponse.json({ error: 'Missing slug or code' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const admin = createAdminClient()
    const upperCode = code.trim().toUpperCase()

    const { data: program } = await admin
      .from('managed_programs')
      .select('id, coach_invite_code, player_invite_code, max_coaches, max_players')
      .eq('landing_slug', slug)
      .maybeSingle()

    if (!program) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 })
    }

    let role: 'coach' | 'player' | null = null
    if (upperCode === program.coach_invite_code) role = 'coach'
    else if (upperCode === program.player_invite_code) role = 'player'

    if (!role) {
      return NextResponse.json({ error: 'Invalid invite code' }, { status: 400 })
    }

    // Check if already a member — if so, let them through
    const { data: existing } = await admin
      .from('program_members')
      .select('id')
      .eq('program_id', program.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ success: true, role, alreadyMember: true })
    }

    // Check spot availability
    const { count } = await admin
      .from('program_members')
      .select('id', { count: 'exact', head: true })
      .eq('program_id', program.id)
      .eq('role', role)

    const used = count ?? 0
    const max = role === 'coach' ? program.max_coaches : program.max_players

    if (used >= max) {
      return NextResponse.json({ error: `This program has reached its ${role} limit.` }, { status: 409 })
    }

    const { error: memberError } = await admin
      .from('program_members')
      .upsert({
        program_id: program.id,
        user_id: user.id,
        email: user.email,
        role,
        registered_via: 'existing_user_invite',
      }, { onConflict: 'program_id,email' })

    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, role })
  } catch (error: any) {
    console.error('[join-with-invite]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
