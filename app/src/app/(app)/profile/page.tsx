import { createClient } from "@/lib/supabase/server"
import { Settings } from "lucide-react"
import { ProfileForm } from "./profile-form"
import { RecruitingDrive } from "@/components/profile/recruiting-drive"
import { getActivePlayerId } from "@/lib/active-player"

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user?.id)
    .single()

  const isCoach = profile?.role === "coach"

  // Coach-specific data
  let coachProfile: { program_name: string; title: string | null } | null = null
  let activePlayerProfile: any = null

  if (isCoach && user) {
    const { data: cp } = await supabase
      .from("coach_profiles")
      .select("program_name, title")
      .eq("id", user.id)
      .single()
    coachProfile = cp

    // Get active player
    const cookiePlayerId = await getActivePlayerId()
    const { data: coachPlayers } = await supabase
      .from("coach_players")
      .select("player_id")
      .eq("coach_id", user.id)

    const playerIds = (coachPlayers || []).map(cp => cp.player_id)
    const activePlayerId = cookiePlayerId && playerIds.includes(cookiePlayerId)
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
      <div>
        <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-foreground sm:text-3xl">
          {isCoach ? "Coach Profile" : "Profile"}
        </h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Settings className="h-3.5 w-3.5 text-accent" />
          {isCoach ? "YOUR INFO & ACTIVE PLAYER DETAILS" : "MANAGE YOUR INFO THAT POWERS OUTREACH"}
        </p>
      </div>

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
                    { label: "GPA", value: activePlayerProfile.gpa },
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

            <RecruitingDrive />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: Profile form */}
          <div className="lg:col-span-5">
            <ProfileForm profile={profile} />
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
