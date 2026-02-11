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

  // Supabase default limit is 1000 — fetch all coaches in batches
  const allCoaches: any[] = []
  const PAGE_SIZE = 1000
  let from = 0
  while (true) {
    const { data: batch } = await supabase
      .from("coaches")
      .select("id, program_id, first_name, last_name, title, email, phone, twitter_handle, twitter_dm_open")
      .order("last_name")
      .range(from, from + PAGE_SIZE - 1)
    if (!batch || batch.length === 0) break
    allCoaches.push(...batch)
    if (batch.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  const coaches = allCoaches

  return (
    <PipelineClient
      stages={stages || []}
      entries={entries || []}
      allPrograms={programs || []}
      allCoaches={coaches || []}
    />
  )
}
