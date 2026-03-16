import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { HubClient } from "./hub-client"

export default async function HubPage() {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("first_name, last_name, position, grad_year, high_school, hudl_url, city, state, twitter_handle, readiness_score_open, workspace_email, jersey_number")
        .eq("id", user.id)
        .single()
    : { data: null }

  const { data: twitterToken } = user
    ? await admin.from("twitter_tokens").select("id, twitter_handle").eq("user_id", user.id).single()
    : { data: null }

  return (
    <HubClient
      profile={profile || { first_name: "Athlete", last_name: null, position: null, grad_year: null, high_school: null, hudl_url: null, city: null, state: null, twitter_handle: null }}
      hasTwitterToken={!!twitterToken}
      twitterHandle={twitterToken?.twitter_handle || null}
      readinessScoreOpen={profile?.readiness_score_open ?? true}
      recruitingEmail={profile?.workspace_email || null}
    />
  )
}
