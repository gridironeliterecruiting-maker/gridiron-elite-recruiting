import { createClient } from "@/lib/supabase/server"
import { CoachesClient } from "./coaches-client"

export default async function CoachesPage() {
  const supabase = await createClient()

  const { data: programs } = await supabase
    .from("programs")
    .select("id, school_name, division, conference, state, city, logo_url, website, espn_id")
    .order("school_name")

  const { data: coaches } = await supabase
    .from("coaches")
    .select("id, program_id, first_name, last_name, title, email, phone, twitter_handle, twitter_dm_open")
    .order("last_name")

  return <CoachesClient programs={programs || []} coaches={coaches || []} />
}
