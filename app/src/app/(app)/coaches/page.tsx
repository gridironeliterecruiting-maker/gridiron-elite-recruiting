import { createClient } from "@/lib/supabase/server"
import { CoachesClient } from "./coaches-client"

export default async function CoachesPage() {
  const supabase = await createClient()

  const { data: programs } = await supabase
    .from("programs")
    .select("id, school_name, division, conference, state, city, logo_url, website, espn_id")
    .order("school_name")

  return <CoachesClient programs={programs || []} />
}
