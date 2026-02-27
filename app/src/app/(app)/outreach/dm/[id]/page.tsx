import { createClient } from "@/lib/supabase/server"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { DmQueueClient } from "./dm-queue-client"

export default async function DmQueuePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const headerStore = await headers()
  const programSlug = headerStore.get('x-program-slug')
  const basePath = programSlug ? `/${programSlug}` : ''

  if (!user) redirect(`${basePath}/login`)

  // Fetch campaign
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("type", "dm")
    .single()

  if (!campaign) redirect(`${basePath}/outreach`)

  // Fetch recipients
  const { data: recipients } = await supabase
    .from("campaign_recipients")
    .select("id, coach_id, coach_name, coach_email, program_name, twitter_handle, status, dm_sent_at")
    .eq("campaign_id", id)
    .order("program_name")

  // Fetch athlete profile for merge tags
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, position, grad_year, hudl_url, high_school, city, state, gpa, phone, email")
    .eq("id", user.id)
    .single()

  return (
    <DmQueueClient
      campaign={campaign}
      recipients={recipients || []}
      profile={profile}
    />
  )
}
