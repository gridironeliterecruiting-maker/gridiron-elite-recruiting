import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')?.trim().toUpperCase()
  const slug = searchParams.get('slug')?.trim().toLowerCase()

  if (!code || !slug) {
    return NextResponse.json({ valid: false, error: 'Missing code or slug' }, { status: 400 })
  }

  try {
    const admin = createAdminClient()

    const { data: program } = await admin
      .from('managed_programs')
      .select('id, school_name, mascot, coach_invite_code, player_invite_code, max_coaches, max_players')
      .eq('landing_slug', slug)
      .maybeSingle()

    if (!program) {
      return NextResponse.json({ valid: false, error: 'Program not found' }, { status: 404 })
    }

    let role: 'coach' | 'player' | null = null
    if (code === program.coach_invite_code) role = 'coach'
    else if (code === program.player_invite_code) role = 'player'

    if (!role) {
      return NextResponse.json({ valid: false, error: 'Invalid invite code' })
    }

    // Count current members of this role
    const { count } = await admin
      .from('program_members')
      .select('id', { count: 'exact', head: true })
      .eq('program_id', program.id)
      .eq('role', role)

    const used = count ?? 0
    const max = role === 'coach' ? program.max_coaches : program.max_players

    if (used >= max) {
      return NextResponse.json({ valid: false, error: `This program has reached its ${role} limit.` })
    }

    return NextResponse.json({
      valid: true,
      role,
      programId: program.id,
      programName: [program.school_name, program.mascot].filter(Boolean).join(' '),
      spotsLeft: max - used,
    })
  } catch (error) {
    console.error('[validate-invite]', error)
    return NextResponse.json({ valid: false, error: 'Internal server error' }, { status: 500 })
  }
}
