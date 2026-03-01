import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { readiness_score_open } = await request.json()

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ readiness_score_open })
    .eq('id', user.id)

  if (error) {
    console.error('[preferences] update failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
