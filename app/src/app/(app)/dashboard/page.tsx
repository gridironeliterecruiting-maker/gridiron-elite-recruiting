import { createClient } from "@/lib/supabase/server"
import { HubClient } from "./hub-client"

export default async function HubPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: profile },
    { count: pipelineCount },
    { data: pipelineStages },
    { data: campaigns },
    { data: twitterToken },
  ] = await Promise.all([
    user
      ? supabase
          .from("profiles")
          .select("first_name, last_name, position, grad_year, high_school, hudl_url, city, state, twitter_handle")
          .eq("id", user.id)
          .single()
      : Promise.resolve({ data: null }),
    supabase.from("pipeline_entries").select("*", { count: "exact", head: true }),
    supabase
      .from("pipeline_stages")
      .select("id, name, display_order")
      .order("display_order"),
    user
      ? supabase
          .from("campaigns")
          .select("id, type")
          .eq("user_id", user.id)
      : Promise.resolve({ data: null }),
    user
      ? supabase
          .from("twitter_tokens")
          .select("id")
          .eq("user_id", user.id)
          .single()
      : Promise.resolve({ data: null }),
  ])

  // Get pipeline entry counts per stage
  const { data: pipelineEntries } = await supabase
    .from("pipeline_entries")
    .select("stage_id")

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
      profile={profile || {
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
      hasTwitterToken={!!twitterToken}
      pipelineCount={pipelineCount || 0}
      stages={stagesWithCounts}
      emailsSent={emailsSent}
      dmsSent={dmsSent}
      campaignCount={campaignIds.length}
    />
  )
}
