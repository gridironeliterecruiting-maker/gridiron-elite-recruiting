import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { is_read } = body as { is_read: boolean }

  const admin = createAdminClient()

  // Verify ownership: the recipient must belong to one of this user's campaigns
  const { data: recipient } = await admin
    .from('campaign_recipients')
    .select('id, campaign_id, campaigns!inner(user_id)')
    .eq('id', id)
    .maybeSingle()

  if (!recipient || (recipient as any).campaigns?.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { error } = await admin
    .from('campaign_recipients')
    .update({ is_read })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
