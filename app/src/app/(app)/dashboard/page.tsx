import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getActivePlayerId } from "@/lib/active-player"
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

  // Check coach_profiles existence (not role string — admin users can also be coaches)
  const { data: _cp } = await admin.from("coach_profiles").select("id").eq("id", user!.id).maybeSingle()
  const isCoach = !!_cp

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

    // Validate the player is linked to this coach
    const { data: coachPlayers } = await supabase
      .from("coach_players")
      .select("player_id")
      .eq("coach_id", user.id)

    const playerIds = (coachPlayers || []).map(cp => cp.player_id)

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

    // Fetch coach program name
    const { data: coachProfile } = await supabase
      .from("coach_profiles")
      .select("program_name")
      .eq("id", user.id)
      .single()
    coachProgramName = coachProfile?.program_name || null
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
    />
  )
}
