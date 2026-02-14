import { createClient } from "@/lib/supabase/server"
import { OutreachClient } from "./outreach-client"

export default async function OutreachPage() {
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
    supabase.from("gmail_tokens").select("email, connected_at, account_tier").eq("user_id", user!.id).single(),
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
    // Get recipients per campaign
    const { data: recipients } = await supabase
      .from("campaign_recipients")
      .select("id, campaign_id, status")
      .in("campaign_id", campaignIds)

    // Get email events per campaign (include recipient_id for unique counting)
    const { data: events } = await supabase
      .from("email_events")
      .select("campaign_id, recipient_id, event_type")
      .in("campaign_id", campaignIds)

    for (const cid of campaignIds) {
      const cRecipients = (recipients || []).filter((r) => r.campaign_id === cid)
      const cEvents = (events || []).filter((e) => e.campaign_id === cid)

      // Count recipients by status
      const sentCount = cRecipients.filter((r) => ['sent', 'replied'].includes(r.status)).length
      // Count unique recipients who opened (not total open events)
      const openedRecipientIds = new Set(
        cEvents.filter((e) => e.event_type === 'opened').map((e) => e.recipient_id)
      )
      const openedCount = openedRecipientIds.size
      const repliedCount = cRecipients.filter((r) => r.status === 'replied').length
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

  return (
    <OutreachClient
      templates={templates || []}
      programs={programs || []}
      playerPosition={playerPosition}
      gmailConnected={!!gmailToken}
      gmailEmail={gmailToken?.email || null}
      gmailTier={gmailToken?.account_tier || null}
      campaigns={(campaigns || []).map((c) => ({
        ...c,
        stats: campaignStats[c.id] || { total: 0, sent: 0, opened: 0, replied: 0, error: 0 },
      }))}
    />
  )
}
