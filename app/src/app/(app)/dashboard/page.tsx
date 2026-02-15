import { createClient } from "@/lib/supabase/server"
import { DashboardClient } from "./dashboard-client"

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const [
    { count: programCount },
    { count: coachCount },
    { count: pipelineCount },
    { data: pipelineStages },
    { data: profile },
  ] = await Promise.all([
    supabase.from("programs").select("*", { count: "exact", head: true }),
    supabase.from("coaches").select("*", { count: "exact", head: true }),
    supabase.from("pipeline_entries").select("*", { count: "exact", head: true }),
    supabase
      .from("pipeline_stages")
      .select("id, name, display_order")
      .order("display_order"),
    user
      ? supabase.from("profiles").select("first_name").eq("id", user.id).single()
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

  return (
    <DashboardClient
      firstName={profile?.first_name || "Athlete"}
      programCount={programCount || 0}
      coachCount={coachCount || 0}
      pipelineCount={pipelineCount || 0}
      stages={stagesWithCounts}
    />
  )
}
