import { headers } from 'next/headers'
import { createAdminClient } from './supabase/admin'

export interface CoachContext {
  isCoach: boolean
  isLegacyCoach: boolean
  managedProgramId: string | null
  programName: string | null  // populated for managed programs
  playerIds: string[]          // player user_ids for managed programs; empty for legacy
}

/**
 * Determines coach status and player list for the CURRENT program only.
 * Reads x-program-slug header set by middleware to know which program we're on.
 *
 * - Managed programs: checks program_members for this user's role
 * - Legacy programs: checks if user.id === coach_profiles owner for this slug
 * - Main site (no slug): always returns isCoach=false
 */
export async function getCoachContext(userId: string): Promise<CoachContext> {
  const headerStore = await headers()
  const programSlug = headerStore.get('x-program-slug')

  if (!programSlug) {
    return { isCoach: false, isLegacyCoach: false, managedProgramId: null, programName: null, playerIds: [] }
  }

  const admin = createAdminClient()

  // Check managed_programs first
  const { data: program } = await admin
    .from('managed_programs')
    .select('id, school_name, mascot')
    .eq('landing_slug', programSlug)
    .maybeSingle()

  if (program) {
    const { data: membership } = await admin
      .from('program_members')
      .select('role')
      .eq('program_id', program.id)
      .eq('user_id', userId)
      .maybeSingle()

    const isCoach = membership?.role === 'coach'
    let playerIds: string[] = []

    if (isCoach) {
      const { data: members } = await admin
        .from('program_members')
        .select('user_id')
        .eq('program_id', program.id)
        .eq('role', 'player')
        .not('user_id', 'is', null)
        .order('created_at')
      playerIds = (members || []).map((m: any) => m.user_id)
    }

    const programName = [program.school_name, program.mascot].filter(Boolean).join(' ')
    return { isCoach, isLegacyCoach: false, managedProgramId: program.id, programName, playerIds }
  }

  // Fall back to legacy coach_profiles
  const { data: legacyCoach } = await admin
    .from('coach_profiles')
    .select('id')
    .eq('landing_slug', programSlug)
    .maybeSingle()

  if (legacyCoach) {
    return {
      isCoach: userId === legacyCoach.id,
      isLegacyCoach: true,
      managedProgramId: null,
      programName: null,
      playerIds: [],
    }
  }

  return { isCoach: false, isLegacyCoach: false, managedProgramId: null, programName: null, playerIds: [] }
}
