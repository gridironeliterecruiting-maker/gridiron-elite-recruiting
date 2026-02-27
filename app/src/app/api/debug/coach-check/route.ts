import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated', authError })
  }

  const admin = createAdminClient()

  // Check profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('first_name, last_name, role')
    .eq('id', user.id)
    .single()

  // Check coach_profiles with ADMIN client (bypass RLS)
  const { data: coachProfileAdmin, error: coachAdminError } = await admin
    .from('coach_profiles')
    .select('id, program_name, landing_slug, logo_url, primary_color')
    .eq('id', user.id)
    .maybeSingle()

  // Check coach_profiles with REGULAR client (subject to RLS)
  const { data: coachProfileRegular, error: coachRegularError } = await supabase
    .from('coach_profiles')
    .select('id, program_name, landing_slug')
    .eq('id', user.id)
    .maybeSingle()

  // Check coach_players
  const { data: coachPlayers, error: playersError } = await admin
    .from('coach_players')
    .select('player_id, profiles!coach_players_player_id_fkey(first_name, last_name)')
    .eq('coach_id', user.id)

  return NextResponse.json({
    userId: user.id,
    email: user.email,
    profile,
    profileError: profileError?.message,
    coachProfileAdmin,
    coachAdminError: coachAdminError?.message,
    coachProfileRegular,
    coachRegularError: coachRegularError?.message,
    coachPlayers,
    playersError: playersError?.message,
    isCoach: !!coachProfileAdmin,
  })
}
