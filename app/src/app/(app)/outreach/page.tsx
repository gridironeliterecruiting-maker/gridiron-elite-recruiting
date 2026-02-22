import { createClient } from "@/lib/supabase/server"
import { OutreachClient } from "./outreach-client"

export default async function OutreachPage({
  searchParams,
}: {
  searchParams: { campaign?: string; gmail?: string; resume?: string }
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: templates },
    { data: programs },
    { data: gmailToken },
    { data: campaigns },
  ] = await Promise.all([
    supabase.from("email_templates").select("*").order("name"),
    supabase.from("programs").select("id, school_name, division, conference, logo_url").order("school_name"),
    supabase.from("gmail_tokens").select("email, connected_at, account_tier, token_expiry").eq("user_id", user!.id).single(),
    supabase.from("campaigns").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }),
  ])

  // Get player position
  let playerPosition = ""
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("position")
      .eq("id", user.id)
      .single()
    playerPosition = profile?.position || ""
  }

  // Get recipient counts and email event stats per campaign
  const campaignIds = (campaigns || []).map((c) => c.id)
  let campaignStats: Record<string, { total: number; sent: number; opened: number; replied: number; error: number }> = {}

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
    for (const c of (campaigns || [])) {
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

        const repliedRecipientIds = new Set(
          cEvents.filter((e) => e.event_type === 'replied').map((e) => e.recipient_id)
        )
        const repliedCount = repliedRecipientIds.size

        const errorCount = cRecipients.filter((r) => ['bounced', 'error'].includes(r.status)).length

        campaignStats[cid] = {
          total: cRecipients.length,
          sent: sentCount,
          opened: openedCount,
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
      campaigns={(campaigns || []).map((c) => ({
        ...c,
        stats: campaignStats[c.id] || { total: 0, sent: 0, opened: 0, replied: 0, error: 0 },
      }))}
      resumeCampaignId={searchParams.campaign}
      resumeStep={searchParams.resume}
      gmailStatus={searchParams.gmail}
    />
  )
}
