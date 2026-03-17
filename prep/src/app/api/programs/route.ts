import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Reads programs from the recruit Supabase (publicly readable reference data)
const recruitSupabase = createClient(
  process.env.RECRUIT_SUPABASE_URL!,
  process.env.RECRUIT_SUPABASE_ANON_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const LOGO_BASE = 'https://runwayrecruit.com'

export async function GET() {
  const { data, error } = await recruitSupabase
    .from('programs')
    .select('id, school_name, division, logo_url, twitter_handle')
    .order('school_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const programs = (data || []).map((p: { id: string; school_name: string; division: string; logo_url: string | null; twitter_handle: string | null }) => ({
    id: p.id,
    school_name: p.school_name,
    division: p.division,
    logo_url: p.logo_url ? `${LOGO_BASE}${p.logo_url}` : null,
    twitter_handle: p.twitter_handle,
  }))

  return NextResponse.json(programs)
}
