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

// POST /api/admin/programs/[id]/members - Add a member
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const supabase = await createClient()
    const user = await requireAdmin(supabase)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { email, role } = await request.json()
    if (!email || !role) {
      return NextResponse.json({ error: 'Email and role are required' }, { status: 400 })
    }
    if (!['coach', 'player'].includes(role)) {
      return NextResponse.json({ error: 'Role must be coach or player' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Check if member already exists
    const { data: existing } = await admin
      .from('program_members')
      .select('id')
      .eq('program_id', id)
      .ilike('email', email.trim())
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'This email is already a member of this program' }, { status: 409 })
    }

    const { data: member, error } = await admin
      .from('program_members')
      .insert({
        program_id: id,
        email: email.trim().toLowerCase(),
        role,
      })
      .select()
      .single()

    if (error) {
      console.error('Error adding member:', error)
      return NextResponse.json({ error: 'Failed to add member' }, { status: 500 })
    }

    return NextResponse.json({ member }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/admin/programs/[id]/members:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/admin/programs/[id]/members - Remove a member
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const supabase = await createClient()
    const user = await requireAdmin(supabase)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { memberId } = await request.json()
    if (!memberId) {
      return NextResponse.json({ error: 'Member ID is required' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { error } = await admin
      .from('program_members')
      .delete()
      .eq('id', memberId)
      .eq('program_id', id)

    if (error) {
      console.error('Error removing member:', error)
      return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/admin/programs/[id]/members:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
