import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // RLS ensures athlete can only delete their own partners
  const { error } = await supabase
    .from('x_partner_profiles')
    .delete()
    .eq('id', id)
    .eq('athlete_id', user.id)

  if (error) return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  return NextResponse.json({ success: true })
}
