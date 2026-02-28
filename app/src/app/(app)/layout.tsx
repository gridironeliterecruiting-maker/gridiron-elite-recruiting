import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import NavBar from '@/components/NavBar'
import { ActivePlayerProvider, type PlayerInfo } from '@/components/ActivePlayerContext'
import { getActivePlayerId } from '@/lib/active-player'
import { UnauthorizedPage } from '@/components/unauthorized-page'

/** Convert a hex color (#RRGGBB) to the raw HSL string Tailwind expects ("H S% L%"). */
function hexToHsl(hex: string): string {
  const m = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!m) return hex // already HSL or unrecognised — pass through
  const r = parseInt(m[1], 16) / 255
  const g = parseInt(m[2], 16) / 255
  const b = parseInt(m[3], 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0, s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Read program slug from header (set by middleware rewrite)
  const headerStore = await headers()
  const programSlug = headerStore.get('x-program-slug')

  if (!user) {
    redirect(programSlug ? `/${programSlug}` : '/login')
  }

  const basePath = programSlug ? `/${programSlug}` : ''

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name, position, grad_year, role')
    .eq('id', user.id)
    .single()

  const admin = createAdminClient()

  // Resolve branding from the URL slug (source of truth)
  // Track whether this is a managed program or legacy coach_profiles program
  let programBranding: {
    program_name: string
    title: string | null
    logo_url: string | null
    primary_color: string | null
    accent_color: string | null
  } | null = null
  let managedProgramId: string | null = null
  let legacyCoachId: string | null = null

  if (programSlug) {
    // Load branding from managed_programs by slug
    const { data: program } = await admin
      .from('managed_programs')
      .select('id, school_name, mascot, logo_url, primary_color, accent_color')
      .eq('landing_slug', programSlug)
      .maybeSingle()

    if (program) {
      managedProgramId = program.id
      programBranding = {
        program_name: [program.school_name, program.mascot].filter(Boolean).join(' '),
        title: null,
        logo_url: program.logo_url,
        primary_color: program.primary_color,
        accent_color: program.accent_color,
      }
    } else {
      // Fall back to coach_profiles by slug (legacy)
      const { data: legacyCoach } = await admin
        .from('coach_profiles')
        .select('id, program_name, title, logo_url, primary_color, accent_color')
        .eq('landing_slug', programSlug)
        .maybeSingle()

      if (legacyCoach) {
        legacyCoachId = legacyCoach.id
        programBranding = legacyCoach
      }
    }
  }
  // No slug = main site. Never apply program branding here — always show Gridiron Elite.

  // Determine isCoach based on the current program only — not globally.
  // The same user can be a coach on one program and a player on another.
  // Also enforce program membership: users not in program_members are denied access.
  let isCoach = false
  let programAccessDenied = false

  if (managedProgramId) {
    const { data: membership } = await admin
      .from('program_members')
      .select('role')
      .eq('program_id', managedProgramId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!membership) {
      programAccessDenied = true
    } else {
      isCoach = membership.role === 'coach'
    }
  } else if (legacyCoachId) {
    // Legacy: the coach IS the user whose profile owns the slug
    isCoach = user.id === legacyCoachId
    if (!isCoach) {
      // Check if user is a registered player for this legacy coach
      const { data: playerRecord } = await admin
        .from('coach_players')
        .select('player_id')
        .eq('coach_id', legacyCoachId)
        .eq('player_id', user.id)
        .maybeSingle()
      if (!playerRecord) {
        programAccessDenied = true
      }
    }
  }
  // No programSlug → main site → no program membership required

  // Gate access: render UnauthorizedPage directly (no redirect — redirecting would loop
  // because the middleware sends /{slug} back to /{slug}/dashboard for logged-in users)
  if (programAccessDenied) {
    // Check for an existing pending access request so the UI shows the right state
    let existingRequestStatus: string | null = null
    if (managedProgramId) {
      const { data: existingRequest } = await admin
        .from('access_requests')
        .select('status')
        .eq('user_id', user.id)
        .eq('program_id', managedProgramId)
        .maybeSingle()
      existingRequestStatus = existingRequest?.status || null
    } else if (legacyCoachId) {
      const { data: existingRequest } = await admin
        .from('access_requests')
        .select('status')
        .eq('user_id', user.id)
        .eq('coach_profile_id', legacyCoachId)
        .maybeSingle()
      existingRequestStatus = existingRequest?.status || null
    }

    return (
      <UnauthorizedPage
        logoSrc={programBranding?.logo_url || '/logo.png'}
        logoAlt={programBranding?.program_name || 'Program'}
        programName={programBranding?.program_name || undefined}
        primaryColor={programBranding?.primary_color || undefined}
        programId={managedProgramId || undefined}
        coachProfileId={legacyCoachId || undefined}
        existingRequestStatus={existingRequestStatus}
      />
    )
  }

  let players: PlayerInfo[] = []
  let activePlayer: PlayerInfo | null = null

  if (isCoach) {
    if (managedProgramId) {
      // Load players from program_members scoped to this program
      const { data: playerMembers } = await admin
        .from('program_members')
        .select('user_id')
        .eq('program_id', managedProgramId)
        .eq('role', 'player')
        .not('user_id', 'is', null)

      if (playerMembers && playerMembers.length > 0) {
        const userIds = playerMembers.map((m: any) => m.user_id)
        const { data: playerProfiles } = await admin
          .from('profiles')
          .select('id, first_name, last_name, position, grad_year, high_school')
          .in('id', userIds)

        if (playerProfiles) {
          players = playerProfiles.map((p: any) => ({
            id: p.id,
            first_name: p.first_name,
            last_name: p.last_name,
            position: p.position,
            grad_year: p.grad_year,
            high_school: p.high_school,
          }))
        }
      }
    } else if (legacyCoachId) {
      // Legacy: load from coach_players
      const { data: coachPlayers } = await supabase
        .from('coach_players')
        .select('player_id, profiles!coach_players_player_id_fkey(id, first_name, last_name, position, grad_year, high_school)')
        .eq('coach_id', user.id)

      if (coachPlayers) {
        players = coachPlayers.map((cp: any) => ({
          id: cp.profiles.id,
          first_name: cp.profiles.first_name,
          last_name: cp.profiles.last_name,
          position: cp.profiles.position,
          grad_year: cp.profiles.grad_year,
          high_school: cp.profiles.high_school,
        }))
      }
    }

    const cookiePlayerId = await getActivePlayerId()
    const validPlayer = cookiePlayerId ? players.find(p => p.id === cookiePlayerId) : null
    activePlayer = validPlayer || players[0] || null
  }

  // Build CSS variable overrides for program branding.
  // CSS variables must be raw HSL numbers (e.g. "0 100% 40%") because Tailwind
  // wraps them as hsl(var(--primary)) — setting a hex value produces invalid CSS.
  const styleOverrides: Record<string, string> = {}
  if (programBranding?.primary_color) {
    styleOverrides['--primary'] = hexToHsl(programBranding.primary_color)
  }
  if (programBranding?.accent_color) {
    styleOverrides['--accent'] = hexToHsl(programBranding.accent_color)
  }

  const isProgramUser = !!programBranding

  return (
    <ActivePlayerProvider activePlayer={activePlayer} players={players} isCoach={isCoach}>
      <div
        className="min-h-screen bg-background"
        style={Object.keys(styleOverrides).length > 0 ? styleOverrides as React.CSSProperties : undefined}
      >
        <NavBar profile={profile} coachBranding={programBranding} basePath={basePath} />
        <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
        <footer className="border-t border-border bg-card">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 lg:px-8">
            <p className="text-xs text-muted-foreground">
              {programBranding?.program_name || 'Gridiron Elite Recruiting'}
            </p>
            <p className="text-xs text-muted-foreground">
              {isProgramUser ? 'Powered by Gridiron Elite Recruiting' : 'Built for athletes, by athletes.'}
            </p>
          </div>
        </footer>
      </div>
    </ActivePlayerProvider>
  )
}
