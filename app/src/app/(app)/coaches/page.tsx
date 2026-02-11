import { createClient } from "@/lib/supabase/server"
import { CoachesClient } from "./coaches-client"

export default async function CoachesPage() {
  const supabase = await createClient()

  const { data: programs } = await supabase
    .from("programs")
    .select("id, school_name, division, conference, state, city, logo_url, website, espn_id")
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

  return <CoachesClient programs={programs || []} coaches={coaches || []} />
}
