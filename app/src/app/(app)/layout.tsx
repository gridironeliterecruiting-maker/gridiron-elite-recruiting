import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import NavBar from '@/components/NavBar'
import { ActivePlayerProvider, type PlayerInfo } from '@/components/ActivePlayerContext'
import { getActivePlayerId } from '@/lib/active-player'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Read program_slug cookie — if set, this user entered through a branded page
  const cookieStore = await cookies()
  const programSlug = cookieStore.get('program_slug')?.value

  if (!user) {
    // Send program users back to their branded login, never the generic /login
    redirect(programSlug ? `/${programSlug}` : '/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name, position, grad_year, role')
    .eq('id', user.id)
    .single()

  // Check if user has a coach profile — use admin client to bypass RLS
  // (admin-role users may be blocked by coach_profiles RLS policies)
  const admin = createAdminClient()
  const { data: coachProfile } = await admin
    .from('coach_profiles')
    .select('program_name, title, logo_url, primary_color, accent_color')
    .eq('id', user.id)
    .maybeSingle()

  const isCoach = !!coachProfile

  // DEBUG: trace coach detection — remove after confirming fix
  console.log(`[Layout DEBUG] user.id=${user.id}, profile.role=${profile?.role}, coachProfile=${JSON.stringify(coachProfile)}, isCoach=${isCoach}, programSlug=${programSlug}`)

  // Resolve branding: coach_profiles first, then program_slug cookie for players
  let coachBranding: {
    program_name: string
    title: string | null
    logo_url: string | null
    primary_color: string | null
    accent_color: string | null
  } | null = coachProfile

  // If no coach branding but user entered via a branded program page, load that program's branding
  if (!coachBranding && programSlug) {
    // Try managed_programs first (new system)
    const { data: program } = await admin
      .from('managed_programs')
      .select('school_name, mascot, logo_url, primary_color, accent_color')
      .eq('landing_slug', programSlug)
      .maybeSingle()

    if (program) {
      coachBranding = {
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
        .select('program_name, title, logo_url, primary_color, accent_color')
        .eq('landing_slug', programSlug)
        .maybeSingle()

      if (legacyCoach) {
        coachBranding = legacyCoach
      }
    }
  }

  let players: PlayerInfo[] = []
  let activePlayer: PlayerInfo | null = null

  if (isCoach) {
    // Fetch linked players
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

    // Resolve active player from cookie
    const cookiePlayerId = await getActivePlayerId()
    const validPlayer = cookiePlayerId ? players.find(p => p.id === cookiePlayerId) : null
    activePlayer = validPlayer || players[0] || null
  }

  // Build CSS variable overrides for program branding
  const styleOverrides: Record<string, string> = {}
  if (coachBranding?.primary_color) {
    styleOverrides['--primary'] = coachBranding.primary_color
  }
  if (coachBranding?.accent_color) {
    styleOverrides['--accent'] = coachBranding.accent_color
  }

  const isProgramUser = !!coachBranding

  return (
    <ActivePlayerProvider activePlayer={activePlayer} players={players} isCoach={isCoach}>
      <div
        className="min-h-screen bg-background"
        style={Object.keys(styleOverrides).length > 0 ? styleOverrides as React.CSSProperties : undefined}
      >
        <NavBar profile={profile} coachBranding={coachBranding} />
        <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
        <footer className="border-t border-border bg-card">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 lg:px-8">
            <p className="text-xs text-muted-foreground">
              {coachBranding?.program_name || 'Gridiron Elite Recruiting'}
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
