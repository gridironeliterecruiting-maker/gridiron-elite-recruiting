import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { computeProposedEmail } from "@/lib/workspace"
import { CoachesClient } from "./coaches-client"

export default async function CoachesPage() {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: programs }, { data: profile }] = await Promise.all([
    supabase.from("programs").select("id, school_name, division, conference, state, city, logo_url, website, espn_id").order("school_name"),
    user ? admin.from("profiles").select("workspace_email, first_name, last_name, jersey_number, grad_year").eq("id", user.id).single() : Promise.resolve({ data: null }),
  ])

  const hasWorkspaceEmail = !!(profile as any)?.workspace_email
  let proposedEmail: string | null = null
  if (!hasWorkspaceEmail && profile?.first_name && profile?.last_name) {
    proposedEmail = await computeProposedEmail(
      profile.first_name,
      profile.last_name,
      (profile as any).jersey_number,
      (profile as any).grad_year,
    )
  }

  return <CoachesClient programs={programs || []} hasWorkspaceEmail={hasWorkspaceEmail} proposedEmail={proposedEmail} />
}
