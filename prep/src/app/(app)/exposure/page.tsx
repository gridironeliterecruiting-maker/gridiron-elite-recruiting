import { createClient } from '@/lib/supabase/server'
import { ExposurePipeline } from '@/components/exposure/pipeline'

export const metadata = { title: 'Exposure — Runway Elite Prep' }

export default async function ExposurePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: connections } = await supabase
    .from('connections')
    .select('*, connection_interactions(count)')
    .eq('parent_id', user!.id)
    .order('last_contact_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  return <ExposurePipeline initialConnections={connections ?? []} />
}
