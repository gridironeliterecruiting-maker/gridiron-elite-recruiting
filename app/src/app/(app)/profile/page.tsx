import { createClient } from "@/lib/supabase/server"
import { formatGPA } from "@/lib/utils"
import { ProfileForm } from "./profile-form"
import { RecruitingDrive } from "@/components/profile/recruiting-drive"
import { getActivePlayerId } from "@/lib/active-player"
import { getCoachContext } from "@/lib/coach-context"
import { ProfileHeader } from "./profile-header"

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user?.id)
    .single()

  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()
  const { data: twitterToken } = await admin
    .from('twitter_tokens')
    .select('twitter_handle')
    .eq('user_id', user?.id)
    .single()

  // Coach status is scoped to the current program only (not global)
  const { isCoach, isLegacyCoach, playerIds: managedPlayerIds, programName: managedProgramName } = await getCoachContext(user!.id)

  // Coach-specific data
  let coachProfile: { program_name: string; title: string | null } | null = null
  let activePlayerProfile: any = null
  let activePlayerId: string | null = null

  if (isCoach && user) {
    // Resolve player list: program_members for managed programs, coach_players for legacy
    let playerIds: string[] = managedPlayerIds
    if (isLegacyCoach) {
      const { data: legacyPlayers } = await supabase
        .from("coach_players")
        .select("player_id")
        .eq("coach_id", user.id)
      playerIds = (legacyPlayers || []).map(cp => cp.player_id)

      // Also fetch coach profile data (title, program_name) for legacy only
      const { data: cp } = await supabase
        .from("coach_profiles")
        .select("program_name, title")
        .eq("id", user.id)
        .single()
      coachProfile = cp
    } else {
      // Managed program: use program name from managed_programs
      coachProfile = { program_name: managedProgramName || '', title: null }
    }

    // Get active player
    const cookiePlayerId = await getActivePlayerId()
    activePlayerId = cookiePlayerId && playerIds.includes(cookiePlayerId)
      ? cookiePlayerId
      : playerIds[0] || null

    if (activePlayerId) {
      const { data: pp } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", activePlayerId)
        .single()
      activePlayerProfile = pp
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <ProfileHeader isCoach={isCoach} />

      {isCoach ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: Coach info */}
          <div className="lg:col-span-5">
            <div className="rounded-xl border bg-card p-6">
              <h2 className="mb-4 font-display text-lg font-bold uppercase tracking-tight">Coach Info</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Name</p>
                  <p className="text-sm font-semibold">{profile?.first_name} {profile?.last_name}</p>
                </div>
                {coachProfile?.title && (
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">Title</p>
                    <p className="text-sm font-semibold">{coachProfile.title}</p>
                  </div>
                )}
                {coachProfile?.program_name && (
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">Program</p>
                    <p className="text-sm font-semibold">{coachProfile.program_name}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Email</p>
                  <p className="text-sm font-semibold">{profile?.email}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Active player info + recruiting drive */}
          <div className="flex flex-col gap-6 lg:col-span-7">
            {activePlayerProfile ? (
              <div className="rounded-xl border bg-card p-6">
                <h2 className="mb-4 font-display text-lg font-bold uppercase tracking-tight">
                  Active Player — {activePlayerProfile.first_name} {activePlayerProfile.last_name}
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {[
                    { label: "Position", value: activePlayerProfile.position },
                    { label: "Class", value: activePlayerProfile.grad_year ? `${activePlayerProfile.grad_year}` : null },
                    { label: "High School", value: activePlayerProfile.high_school },
                    { label: "Location", value: [activePlayerProfile.city, activePlayerProfile.state].filter(Boolean).join(", ") },
                    { label: "GPA", value: formatGPA(activePlayerProfile.gpa) },
                    { label: "Height", value: activePlayerProfile.height },
                    { label: "Weight", value: activePlayerProfile.weight ? `${activePlayerProfile.weight} lbs` : null },
                    { label: "Hudl", value: activePlayerProfile.hudl_url ? "Connected" : null },
                  ]
                    .filter(item => item.value)
                    .map(item => (
                      <div key={item.label}>
                        <p className="text-xs font-medium uppercase text-muted-foreground">{item.label}</p>
                        <p className="text-sm font-semibold">{item.value}</p>
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
                No active player selected.
              </div>
            )}

            <RecruitingDrive playerId={activePlayerId} readOnly />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: Profile form */}
          <div className="lg:col-span-5">
            <ProfileForm profile={profile} twitterConnectedHandle={twitterToken?.twitter_handle || null} />
          </div>

          {/* Right: Recruiting Drive */}
          <div className="lg:col-span-7">
            <RecruitingDrive />
          </div>
        </div>
      )}
    </div>
  )
}
