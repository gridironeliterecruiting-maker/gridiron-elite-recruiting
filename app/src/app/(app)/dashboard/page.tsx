import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getActivePlayerId } from "@/lib/active-player"
import { getCoachContext } from "@/lib/coach-context"
import { HubClient } from "./hub-client"

export default async function HubPage() {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: userProfile } = user
    ? await supabase
        .from("profiles")
        .select("first_name, last_name, position, grad_year, high_school, hudl_url, city, state, twitter_handle, role")
        .eq("id", user.id)
        .single()
    : { data: null }

  // Coach status is scoped to the current program only (not global)
  const { isCoach, isLegacyCoach, managedProgramId, playerIds: managedPlayerIds, programName: managedProgramName } = await getCoachContext(user!.id)

  // For coaches, determine active player and use their profile for merge tag preview data
  let activePlayerId: string | null = null
  let playerProfile: {
    first_name: string | null
    last_name: string | null
    position: string | null
    grad_year: number | null
    high_school: string | null
    hudl_url: string | null
    city: string | null
    state: string | null
    twitter_handle: string | null
  } | null = null
  let coachProgramName: string | null = null

  if (isCoach && user) {
    // Get active player from cookie
    const cookiePlayerId = await getActivePlayerId()

    // Resolve player list: program_members for managed programs, coach_players for legacy
    let playerIds: string[] = managedPlayerIds
    if (isLegacyCoach) {
      const { data: coachPlayers } = await supabase
        .from("coach_players")
        .select("player_id")
        .eq("coach_id", user.id)
      playerIds = (coachPlayers || []).map(cp => cp.player_id)
    }

    if (cookiePlayerId && playerIds.includes(cookiePlayerId)) {
      activePlayerId = cookiePlayerId
    } else if (playerIds.length > 0) {
      activePlayerId = playerIds[0]
    }

    // Fetch the active player's profile
    if (activePlayerId) {
      const { data: pp } = await supabase
        .from("profiles")
        .select("first_name, last_name, position, grad_year, high_school, hudl_url, city, state, twitter_handle")
        .eq("id", activePlayerId)
        .single()
      playerProfile = pp
    }

    // Program name: from managed_programs for managed programs, coach_profiles for legacy
    if (isLegacyCoach) {
      const { data: coachProfile } = await supabase
        .from("coach_profiles")
        .select("program_name")
        .eq("id", user.id)
        .single()
      coachProgramName = coachProfile?.program_name || null
    } else {
      coachProgramName = managedProgramName
    }
  }

  // For coaches, also check if the active player has a connected Twitter account
  let playerTwitterHandle: string | null = null
  let playerHasTwitterToken = false
  if (isCoach && activePlayerId) {
    const { data: playerTwitterToken } = await admin
      .from("twitter_tokens")
      .select("twitter_handle")
      .eq("user_id", activePlayerId)
      .single()
    if (playerTwitterToken) {
      playerHasTwitterToken = true
      playerTwitterHandle = playerTwitterToken.twitter_handle
    }
  }

  // The profile to display stats for: player profile for coaches, own profile for athletes
  const displayProfile = isCoach && playerProfile ? playerProfile : userProfile

  // Fetch pipeline and campaign data scoped to the correct athlete
  const pipelineAthleteId = isCoach ? activePlayerId : user?.id

  const [
    { count: pipelineCount },
    { data: pipelineStages },
    { data: campaigns },
    { data: twitterToken },
  ] = await Promise.all([
    pipelineAthleteId
      ? supabase.from("pipeline_entries").select("*", { count: "exact", head: true }).eq("athlete_id", pipelineAthleteId)
      : Promise.resolve({ count: 0 }),
    supabase
      .from("pipeline_stages")
      .select("id, name, display_order")
      .order("display_order"),
    user
      ? supabase
          .from("campaigns")
          .select("id, type, player_id")
          .eq("user_id", user.id)
          .then(res => {
            // For coaches, filter to active player's campaigns
            if (isCoach && activePlayerId && res.data) {
              return { ...res, data: res.data.filter(c => c.player_id === activePlayerId) }
            }
            return res
          })
      : Promise.resolve({ data: null }),
    user
      ? admin
          .from("twitter_tokens")
          .select("id, twitter_handle, connected_at")
          .eq("user_id", user.id)
          .single()
      : Promise.resolve({ data: null }),
  ])

  // Get pipeline entry counts per stage (scoped to athlete)
  const { data: pipelineEntries } = pipelineAthleteId
    ? await supabase.from("pipeline_entries").select("stage_id").eq("athlete_id", pipelineAthleteId)
    : { data: null }

  const stageCounts: Record<string, number> = {}
  if (pipelineEntries) {
    for (const entry of pipelineEntries) {
      stageCounts[entry.stage_id] = (stageCounts[entry.stage_id] || 0) + 1
    }
  }

  const stagesWithCounts = (pipelineStages || []).map((stage) => ({
    name: stage.name,
    count: stageCounts[stage.id] || 0,
  }))

  // Fetch active pipeline programs with team Twitter handles (for "Engage Target Schools on X")
  type PipelineProgram = { programId: string; schoolName: string; logoUrl: string | null; twitterHandle: string }
  let pipelinePrograms: PipelineProgram[] = []

  if (!isCoach && pipelineAthleteId) {
    const { data: activeEntries } = await supabase
      .from("pipeline_entries")
      .select("program_id, programs(id, school_name, logo_url)")
      .eq("athlete_id", pipelineAthleteId)
      .eq("status", "active")

    if (activeEntries && activeEntries.length > 0) {
      const programIds = activeEntries.map((e: any) => e.program_id)
      const { data: teamTwitter } = await supabase
        .from("coaches")
        .select("program_id, twitter_handle")
        .in("program_id", programIds)
        .eq("title", "Team Twitter")
        .eq("is_active", true)

      if (teamTwitter && teamTwitter.length > 0) {
        const handleMap: Record<string, string> = {}
        for (const t of teamTwitter) {
          if (t.twitter_handle) handleMap[t.program_id] = t.twitter_handle
        }
        pipelinePrograms = (activeEntries as any[])
          .filter(e => handleMap[e.program_id])
          .map(e => ({
            programId: e.program_id,
            schoolName: e.programs?.school_name || "",
            logoUrl: e.programs?.logo_url || null,
            twitterHandle: handleMap[e.program_id],
          }))
          .sort((a, b) => a.schoolName.localeCompare(b.schoolName))
      }
    }
  }

  // Fetch pending access requests for coaches on managed programs
  let pendingAccessRequests: { id: string; user_email: string; user_name: string | null }[] = []
  if (isCoach && managedProgramId) {
    const { data: accessRequests } = await admin
      .from('access_requests')
      .select('id, user_email, user_name')
      .eq('program_id', managedProgramId)
      .eq('status', 'pending')
    pendingAccessRequests = accessRequests || []
  }

  // Get outreach stats — emails sent + DMs sent
  const campaignIds = (campaigns || []).map((c) => c.id)
  let emailsSent = 0
  let dmsSent = 0

  if (campaignIds.length > 0) {
    const { data: recipients } = await supabase
      .from("campaign_recipients")
      .select("campaign_id, status, dm_sent_at")
      .in("campaign_id", campaignIds)

    const campaignTypeMap: Record<string, string> = {}
    for (const c of (campaigns || [])) {
      campaignTypeMap[c.id] = c.type || "email"
    }

    for (const r of (recipients || [])) {
      if (campaignTypeMap[r.campaign_id] === "dm") {
        if (r.dm_sent_at) dmsSent++
      } else {
        if (r.status === "sent" || r.status === "delivered" || r.status === "opened") {
          emailsSent++
        }
      }
    }
  }

  return (
    <HubClient
      profile={displayProfile || {
        first_name: "Athlete",
        last_name: null,
        position: null,
        grad_year: null,
        high_school: null,
        hudl_url: null,
        city: null,
        state: null,
        twitter_handle: null,
      }}
      isCoach={isCoach}
      coachFirstName={isCoach ? (userProfile?.first_name || "Coach") : undefined}
      coachProgramName={coachProgramName}
      activePlayerId={activePlayerId}
      activePlayerName={playerProfile ? `${playerProfile.first_name} ${playerProfile.last_name}` : null}
      hasTwitterToken={!!twitterToken}
      twitterHandle={twitterToken?.twitter_handle || null}
      playerHasTwitterToken={playerHasTwitterToken}
      playerTwitterHandle={playerTwitterHandle}
      pipelineCount={pipelineCount || 0}
      stages={stagesWithCounts}
      emailsSent={emailsSent}
      dmsSent={dmsSent}
      campaignCount={campaignIds.length}
      pipelinePrograms={pipelinePrograms}
      pendingAccessRequests={pendingAccessRequests}
    />
  )
}
