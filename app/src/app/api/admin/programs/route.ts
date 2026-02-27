import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') return null
  return user
}

// GET /api/admin/programs - List all managed programs with members
export async function GET() {
  try {
    const supabase = await createClient()
    const user = await requireAdmin(supabase)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { data: programs, error } = await admin
      .from('managed_programs')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching programs:', error)
      return NextResponse.json({ error: 'Failed to fetch programs' }, { status: 500 })
    }

    // Fetch members for all programs
    const programIds = programs.map((p: { id: string }) => p.id)
    const { data: members } = await admin
      .from('program_members')
      .select('*')
      .in('program_id', programIds.length > 0 ? programIds : ['none'])

    // Attach members to programs
    const programsWithMembers = programs.map((p: { id: string }) => ({
      ...p,
      members: (members || []).filter((m: { program_id: string }) => m.program_id === p.id),
    }))

    return NextResponse.json({ programs: programsWithMembers })
  } catch (error) {
    console.error('Error in GET /api/admin/programs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/programs - Create a new program
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAdmin(supabase)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const {
      school_name, mascot, city, state, landing_slug,
      primary_color, secondary_color, accent_color,
      twitter_username, hudl_url, instagram_username,
    } = body

    if (!school_name) {
      return NextResponse.json({ error: 'School name is required' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: program, error } = await admin
      .from('managed_programs')
      .insert({
        school_name,
        mascot: mascot || null,
        city: city || null,
        state: state || null,
        landing_slug: landing_slug || null,
        primary_color: primary_color || '#0047AB',
        secondary_color: secondary_color || '#FFFFFF',
        accent_color: accent_color || '#CC0000',
        twitter_username: twitter_username || null,
        hudl_url: hudl_url || null,
        instagram_username: instagram_username || null,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505' && error.message.includes('landing_slug')) {
        return NextResponse.json({ error: 'That URL slug is already in use' }, { status: 409 })
      }
      console.error('Error creating program:', error)
      return NextResponse.json({ error: 'Failed to create program' }, { status: 500 })
    }

    return NextResponse.json({ program }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/admin/programs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
