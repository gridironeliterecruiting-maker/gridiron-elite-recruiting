import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Remove OAuth token
  await admin.from('twitter_tokens').delete().eq('user_id', user.id)

  // Clear synced handle on profile
  await admin.from('profiles').update({ twitter_handle: null }).eq('id', user.id)

  return NextResponse.json({ success: true })
}
