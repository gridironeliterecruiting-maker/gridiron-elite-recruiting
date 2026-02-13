import { createClient } from "@/lib/supabase/server"
import { OutreachClient } from "./outreach-client"

export default async function OutreachPage() {
  const supabase = await createClient()

  const [{ data: templates }, { data: programs }, { data: { user } }] = await Promise.all([
    supabase.from("email_templates").select("*").order("name"),
    supabase.from("programs").select("id, school_name, division, conference, logo_url").order("school_name"),
    supabase.auth.getUser(),
  ])

  let playerPosition = ""
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("position")
      .eq("id", user.id)
      .single()
    playerPosition = profile?.position || ""
  }

  return (
    <OutreachClient
      templates={templates || []}
      programs={programs || []}
      playerPosition={playerPosition}
    />
  )
}
