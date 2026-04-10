import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getActivePlayerId } from "@/lib/active-player"
import { getCoachContext } from "@/lib/coach-context"
import { computeProposedEmail } from "@/lib/workspace"
import { getMissingProfileFields } from "@/lib/profile-complete"
import { OutreachClient } from "./outreach-client"

export default async function OutreachPage({
  searchParams,
}: {
  searchParams: { campaign?: string; gmail?: string; twitter?: string; resume?: string }
}) {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Determine role + profile completeness
  const { data: userProfile } = await supabase
    .from("profiles")
    .select("position, role, first_name, last_name, grad_year, high_school, city, state, gpa, primary_video_url, phone, coach_name, coach_phone, coach_email")
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
    { data: zohoProfile },
  ] = await Promise.all([
    supabase.from("email_templates").select("*").eq("for_role", templateRole).order("name"),
    supabase.from("programs").select("id, school_name, division, conference, logo_url").order("school_name"),
    admin.from("gmail_tokens").select("email, connected_at, token_expiry").eq("user_id", user!.id).single(),
    admin.from("twitter_tokens").select("twitter_handle, connected_at, token_expiry").eq("user_id", user!.id).single(),
    supabase.from("campaigns").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }),
    admin.from("profiles").select("zoho_account_key, workspace_email").eq("id", user!.id).single(),
  ])

  // Compute proposed email for athletes without a workspace email
  const hasWorkspaceEmail = !!(zohoProfile as any)?.workspace_email
  let proposedEmail: string | null = (zohoProfile as any)?.workspace_email || null
  if (!isCoach && !hasWorkspaceEmail && userProfile?.position !== undefined) {
    const { data: fullProfile } = await admin
      .from('profiles')
      .select('first_name, last_name, jersey_number, grad_year')
      .eq('id', user!.id)
      .single()
    if (fullProfile?.first_name && fullProfile?.last_name) {
      proposedEmail = await computeProposedEmail(
        fullProfile.first_name,
        fullProfile.last_name,
        fullProfile.jersey_number,
        fullProfile.grad_year,
      )
    }
  }

  // Zoho users don't need Gmail — treat them as having a valid connected account
  const isZohoUser = !!(zohoProfile as any)?.zoho_account_key
  const effectiveGmailToken = isZohoUser
    ? { email: (zohoProfile as any).workspace_email, token_expiry: new Date(Date.now() + 86400000).toISOString() }
    : gmailToken

  // Filter campaigns: for coaches, only show campaigns for the active player
  const campaigns = isCoach && activePlayerId
    ? (allCampaigns || []).filter(c => c.player_id === activePlayerId)
    : (allCampaigns || [])

  // Get player position + profile completeness — from active player for coaches, own profile for athletes
  let playerPosition = ""
  let missingProfileFields: string[] = []
  if (isCoach && activePlayerId) {
    const { data: playerProfile } = await supabase
      .from("profiles")
      .select("position, first_name, last_name, grad_year, high_school, city, state, gpa, primary_video_url, phone, coach_name, coach_phone, coach_email")
      .eq("id", activePlayerId)
      .single()
    playerPosition = playerProfile?.position || ""
    missingProfileFields = playerProfile ? getMissingProfileFields(playerProfile) : []
  } else {
    playerPosition = userProfile?.position || ""
    missingProfileFields = userProfile ? getMissingProfileFields(userProfile) : []
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
    // Exclude scanner-flagged events so stats reflect only real engagement
    const { data: events } = await supabase
      .from("email_events")
      .select("campaign_id, recipient_id, event_type")
      .in("campaign_id", campaignIds)
      .is("scanner_flagged_at", null)

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
      gmailEmail={effectiveGmailToken?.email || null}
      hasGmailToken={!!effectiveGmailToken}
      gmailTokenExpired={effectiveGmailToken ? new Date(effectiveGmailToken.token_expiry) <= new Date() : false}
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
      hasWorkspaceEmail={hasWorkspaceEmail}
      proposedEmail={proposedEmail}
      missingProfileFields={missingProfileFields}
    />
  )
}
