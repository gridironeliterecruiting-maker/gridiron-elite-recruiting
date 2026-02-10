import { createClient } from "@/lib/supabase/server"
import { OutreachClient } from "./outreach-client"

export default async function OutreachPage() {
  const supabase = await createClient()

  const { data: templates } = await supabase
    .from("email_templates")
    .select("*")
    .order("name")

  return <OutreachClient templates={templates || []} />
}
