import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { PipelineClient } from "./pipeline-client"

export default async function PipelinePage() {
  const supabase = await createClient()

  // Coach guard — coaches don't have a Pipeline tab
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()
    if (profile?.role === "coach") {
      redirect("/dashboard")
    }
  }

  const { data: stages } = await supabase
    .from("pipeline_stages")
    .select("id, name, display_order")
    .order("display_order")

  const { data: entries } = await supabase
    .from("pipeline_entries")
    .select("id, program_id, stage_id, status, notes, programs(id, school_name, division, conference, logo_url, website, state, city, espn_id)")

  const { data: programs } = await supabase
    .from("programs")
    .select("id, school_name, division, conference, logo_url, website, state, city, espn_id")
    .order("school_name")

  return (
    <PipelineClient
      stages={stages || []}
      entries={entries || []}
      allPrograms={programs || []}
    />
  )
}
