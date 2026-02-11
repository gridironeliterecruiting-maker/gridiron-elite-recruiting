import { createClient } from "@/lib/supabase/server"
import { PipelineClient } from "./pipeline-client"

export default async function PipelinePage() {
  const supabase = await createClient()

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

  const { data: coaches } = await supabase
    .from("coaches")
    .select("id, program_id, first_name, last_name, title, email, phone, twitter_handle, twitter_dm_open")
    .order("last_name")

  return (
    <PipelineClient
      stages={stages || []}
      entries={entries || []}
      allPrograms={programs || []}
      allCoaches={coaches || []}
    />
  )
}
