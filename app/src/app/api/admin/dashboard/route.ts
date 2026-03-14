import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return null
  return user
}

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const [
    { count: recruits },
    { count: programs },
    { count: coaches },
    { count: campaigns },
    { count: offers },
  ] = await Promise.all([
    admin.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'athlete'),
    admin.from('programs').select('*', { count: 'exact', head: true }),
    admin.from('coaches').select('*', { count: 'exact', head: true }).eq('is_active', true),
    admin.from('campaigns').select('*', { count: 'exact', head: true }),
    admin.from('pipeline_entries').select('*', { count: 'exact', head: true })
      .in('stage_id',
        (await admin.from('pipeline_stages').select('id').eq('name', 'Offer')).data?.map(s => s.id) || []
      ),
  ])

  return NextResponse.json({
    recruits: recruits ?? 0,
    programs: programs ?? 0,
    coaches: coaches ?? 0,
    campaigns: campaigns ?? 0,
    offers: offers ?? 0,
  })
}
