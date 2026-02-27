import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

/**
 * POST: Migrate legacy coach_profiles into managed_programs.
 * Creates managed_programs entries + program_members for coach + linked players.
 * Safe to run multiple times — skips programs that already have a matching slug.
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Admin-only
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const migrated: string[] = []
  const skipped: string[] = []

  // Get all coach_profiles with a landing_slug
  const { data: coachProfiles } = await admin
    .from('coach_profiles')
    .select('id, program_name, logo_url, primary_color, accent_color, landing_slug, title')
    .not('landing_slug', 'is', null)

  if (!coachProfiles || coachProfiles.length === 0) {
    return NextResponse.json({ message: 'No legacy programs to migrate', migrated, skipped })
  }

  for (const cp of coachProfiles) {
    // Check if already migrated (matching slug in managed_programs)
    const { data: existing } = await admin
      .from('managed_programs')
      .select('id')
      .eq('landing_slug', cp.landing_slug)
      .maybeSingle()

    if (existing) {
      skipped.push(cp.program_name)
      continue
    }

    // Parse program_name into school_name and mascot (e.g. "Prairie Hawks" → "Prairie", "Hawks")
    const nameParts = cp.program_name.split(' ')
    const mascot = nameParts.length > 1 ? nameParts.pop()! : null
    const schoolName = nameParts.join(' ')

    // Get coach's profile for email and location
    const { data: coachUser } = await admin
      .from('profiles')
      .select('email, city, state')
      .eq('id', cp.id)
      .single()

    // Create managed_programs entry
    const { data: newProgram, error: insertError } = await admin
      .from('managed_programs')
      .insert({
        school_name: schoolName,
        mascot,
        city: coachUser?.city || null,
        state: coachUser?.state || null,
        landing_slug: cp.landing_slug,
        logo_url: cp.logo_url,
        primary_color: cp.primary_color,
        accent_color: cp.accent_color,
      })
      .select('id')
      .single()

    if (insertError || !newProgram) {
      console.error(`Failed to migrate ${cp.program_name}:`, insertError)
      continue
    }

    // Add coach as program_member
    if (coachUser?.email) {
      await admin.from('program_members').insert({
        program_id: newProgram.id,
        email: coachUser.email,
        role: 'coach',
        user_id: cp.id,
      })
    }

    // Add linked players as program_members
    const { data: players } = await admin
      .from('coach_players')
      .select('player_id, profiles!coach_players_player_id_fkey(email)')
      .eq('coach_id', cp.id)

    if (players) {
      for (const p of players) {
        const playerEmail = (p.profiles as any)?.email
        if (playerEmail) {
          await admin.from('program_members').insert({
            program_id: newProgram.id,
            email: playerEmail,
            role: 'player',
            user_id: p.player_id,
          })
        }
      }
    }

    migrated.push(cp.program_name)
  }

  return NextResponse.json({ message: 'Migration complete', migrated, skipped })
}
