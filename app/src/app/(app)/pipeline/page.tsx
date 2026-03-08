import { createClient } from "@/lib/supabase/server"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { getCoachContext } from "@/lib/coach-context"
import { PipelineClient } from "./pipeline-client"

export default async function PipelinePage() {
  const supabase = await createClient()

  const headerStore = await headers()
  const programSlug = headerStore.get('x-program-slug')
  const basePath = programSlug ? `/${programSlug}` : ''

  // Coach guard — coaches don't have a Pipeline tab (scoped to current program)
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { isCoach } = await getCoachContext(user.id)
    if (isCoach) {
      redirect(`${basePath}/hub`)
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
