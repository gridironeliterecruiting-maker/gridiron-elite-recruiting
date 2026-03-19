import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('target_schools')
    .select('id, program_id, school_name, logo_url, twitter_handle')
    .eq('user_id', user.id)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const programs: { id: string; school_name: string; logo_url: string | null; twitter_handle: string | null }[] = await request.json()
  if (!Array.isArray(programs) || programs.length === 0) {
    return NextResponse.json({ error: 'No programs provided' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Skip duplicates already in the table
  const { data: existing } = await admin
    .from('target_schools')
    .select('program_id')
    .eq('user_id', user.id)

  const existingIds = new Set((existing || []).map((r: { program_id: string }) => r.program_id))
  const toInsert = programs
    .filter(p => !existingIds.has(p.id))
    .map(p => ({
      user_id: user.id,
      program_id: p.id,
      school_name: p.school_name,
      logo_url: p.logo_url,
      twitter_handle: p.twitter_handle,
    }))

  if (toInsert.length === 0) return NextResponse.json([])

  const { data, error } = await admin
    .from('target_schools')
    .insert(toInsert)
    .select('id, program_id, school_name, logo_url, twitter_handle')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}
