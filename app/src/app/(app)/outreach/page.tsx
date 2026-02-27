import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getActivePlayerId } from "@/lib/active-player"
import { getCoachContext } from "@/lib/coach-context"
import { OutreachClient } from "./outreach-client"

export default async function OutreachPage({
  searchParams,
}: {
  searchParams: { campaign?: string; gmail?: string; twitter?: string; resume?: string }
}) {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Determine role
  const { data: userProfile } = await supabase
    .from("profiles")
    .select("position, role")
    .eq("id", user!.id)
    .single()

  // Coach status is scoped to the current program only (not global)
  const { isCoach, isLegacyCoach, playerIds: managedPlayerIds } = await getCoachContext(user!.id)

  // For coaches, resolve active player
  let activePlayerId: string | null = null
  if (isCoach) {
    const cookiePlayerId = await getActivePlayerId()

    // Resolve player list: program_members for managed programs, coach_players for legacy
    let playerIds: string[] = managedPlayerIds
    if (isLegacyCoach) {
      const { data: coachPlayers } = await supabase
        .from("coach_players")
        .select("player_id")
        .eq("coach_id", user!.id)
      playerIds = (coachPlayers || []).map(cp => cp.player_id)
    }

    if (cookiePlayerId && playerIds.includes(cookiePlayerId)) {
      activePlayerId = cookiePlayerId
    } else if (playerIds.length > 0) {
      activePlayerId = playerIds[0]
    }
  }

  // Filter templates by role
  const templateRole = isCoach ? 'coach' : 'athlete'

  const [
    { data: templates },
    { data: programs },
    { data: gmailToken },
    { data: twitterToken },
    { data: allCampaigns },
  ] = await Promise.all([
    supabase.from("email_templates").select("*").eq("for_role", templateRole).order("name"),
    supabase.from("programs").select("id, school_name, division, conference, logo_url").order("school_name"),
    admin.from("gmail_tokens").select("email, connected_at, account_tier, token_expiry").eq("user_id", user!.id).single(),
    admin.from("twitter_tokens").select("twitter_handle, connected_at, token_expiry").eq("user_id", user!.id).single(),
    supabase.from("campaigns").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }),
  ])

  // Filter campaigns: for coaches, only show campaigns for the active player
  const campaigns = isCoach && activePlayerId
    ? (allCampaigns || []).filter(c => c.player_id === activePlayerId)
    : (allCampaigns || [])

  // Get player position — from active player for coaches, own profile for athletes
  let playerPosition = ""
  if (isCoach && activePlayerId) {
    const { data: playerProfile } = await supabase
      .from("profiles")
      .select("position")
      .eq("id", activePlayerId)
      .single()
    playerPosition = playerProfile?.position || ""
  } else {
    playerPosition = userProfile?.position || ""
  }

  // Get recipient counts and email event stats per campaign
  const campaignIds = campaigns.map((c) => c.id)
  let campaignStats: Record<string, { total: number; sent: number; opened: number; clicked: number; replied: number; error: number }> = {}

  if (campaignIds.length > 0) {
    // Get recipients per campaign (include dm_sent_at for DM campaigns)
    const { data: recipients } = await supabase
      .from("campaign_recipients")
      .select("id, campaign_id, status, dm_sent_at")
      .in("campaign_id", campaignIds)

    // Get email events per campaign (include recipient_id for unique counting)
    const { data: events } = await supabase
      .from("email_events")
      .select("campaign_id, recipient_id, event_type")
      .in("campaign_id", campaignIds)

    // Build a map of campaign type for quick lookup
    const campaignTypeMap: Record<string, string> = {}
    for (const c of campaigns) {
      campaignTypeMap[c.id] = c.type || 'email'
    }

    for (const cid of campaignIds) {
      const cRecipients = (recipients || []).filter((r) => r.campaign_id === cid)
      const isDm = campaignTypeMap[cid] === 'dm'

      if (isDm) {
        // DM campaigns: count dm_sent_at for sent
        const sentCount = cRecipients.filter((r) => r.dm_sent_at !== null).length
        campaignStats[cid] = {
          total: cRecipients.length,
          sent: sentCount,
          opened: 0,
          clicked: 0,
          replied: 0,
          error: 0,
        }
      } else {
        // Email campaigns: use email events
        const cEvents = (events || []).filter((e) => e.campaign_id === cid)

        const sentRecipientIds = new Set(
          cEvents.filter((e) => e.event_type === 'sent').map((e) => e.recipient_id)
        )
        const sentCount = sentRecipientIds.size

        const openedRecipientIds = new Set(
          cEvents.filter((e) => e.event_type === 'opened').map((e) => e.recipient_id)
        )
        const openedCount = openedRecipientIds.size

        const clickedRecipientIds = new Set(
          cEvents.filter((e) => e.event_type === 'clicked').map((e) => e.recipient_id)
        )
        const clickedCount = clickedRecipientIds.size

        const repliedRecipientIds = new Set(
          cEvents.filter((e) => e.event_type === 'replied').map((e) => e.recipient_id)
        )
        const repliedCount = repliedRecipientIds.size

        const errorCount = cRecipients.filter((r) => ['bounced', 'error'].includes(r.status)).length

        campaignStats[cid] = {
          total: cRecipients.length,
          sent: sentCount,
          opened: openedCount,
          clicked: clickedCount,
          replied: repliedCount,
          error: errorCount,
        }
      }
    }
  }

  return (
    <OutreachClient
      templates={templates || []}
      programs={programs || []}
      playerPosition={playerPosition}
      gmailEmail={gmailToken?.email || null}
      gmailTier={gmailToken?.account_tier || null}
      hasGmailToken={!!gmailToken}
      gmailTokenExpired={gmailToken ? new Date(gmailToken.token_expiry) <= new Date() : false}
      twitterHandle={twitterToken?.twitter_handle || null}
      hasTwitterToken={!!twitterToken}
      campaigns={campaigns.map((c) => ({
        ...c,
        stats: campaignStats[c.id] || { total: 0, sent: 0, opened: 0, clicked: 0, replied: 0, error: 0 },
      }))}
      activePlayerId={isCoach ? activePlayerId : null}
      resumeCampaignId={searchParams.campaign}
      resumeStep={searchParams.resume}
      gmailStatus={searchParams.gmail}
      twitterStatus={searchParams.twitter}
    />
  )
}
