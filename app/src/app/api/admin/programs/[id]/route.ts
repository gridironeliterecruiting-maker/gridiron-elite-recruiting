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

// GET /api/admin/programs/[id]
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const supabase = await createClient()
    const user = await requireAdmin(supabase)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { data: program, error } = await admin
      .from('managed_programs')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 })
    }

    const { data: members } = await admin
      .from('program_members')
      .select('*')
      .eq('program_id', id)
      .order('role')
      .order('email')

    return NextResponse.json({ program: { ...program, members: members || [] } })
  } catch (error) {
    console.error('Error in GET /api/admin/programs/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/admin/programs/[id]
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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

    const admin = createAdminClient()
    const { data: program, error } = await admin
      .from('managed_programs')
      .update({
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
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === '23505' && error.message.includes('landing_slug')) {
        return NextResponse.json({ error: 'That URL slug is already in use' }, { status: 409 })
      }
      console.error('Error updating program:', error)
      return NextResponse.json({ error: 'Failed to update program' }, { status: 500 })
    }

    return NextResponse.json({ program })
  } catch (error) {
    console.error('Error in PUT /api/admin/programs/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/admin/programs/[id]
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const supabase = await createClient()
    const user = await requireAdmin(supabase)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { error } = await admin
      .from('managed_programs')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting program:', error)
      return NextResponse.json({ error: 'Failed to delete program' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/admin/programs/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
