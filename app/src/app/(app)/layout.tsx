import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NavBar from '@/components/NavBar'
import { ActivePlayerProvider, type PlayerInfo } from '@/components/ActivePlayerContext'
import { getActivePlayerId } from '@/lib/active-player'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name, position, grad_year, role')
    .eq('id', user.id)
    .single()

  const isCoach = profile?.role === 'coach'

  // Coach-specific data
  let coachBranding: {
    program_name: string
    title: string | null
    logo_url: string | null
    primary_color: string | null
    accent_color: string | null
  } | null = null
  let players: PlayerInfo[] = []
  let activePlayer: PlayerInfo | null = null

  if (isCoach) {
    // Fetch coach branding
    const { data: coachProfile } = await supabase
      .from('coach_profiles')
      .select('program_name, title, logo_url, primary_color, accent_color')
      .eq('id', user.id)
      .single()

    coachBranding = coachProfile

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

  // Build CSS variable overrides for coach branding
  const styleOverrides: Record<string, string> = {}
  if (coachBranding?.primary_color) {
    styleOverrides['--primary'] = coachBranding.primary_color
  }
  if (coachBranding?.accent_color) {
    styleOverrides['--accent'] = coachBranding.accent_color
  }

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
              {isCoach ? 'Powered by Gridiron Elite Recruiting' : 'Built for athletes, by athletes.'}
            </p>
          </div>
        </footer>
      </div>
    </ActivePlayerProvider>
  )
}
