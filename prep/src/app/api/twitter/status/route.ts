import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data: token } = await admin
      .from('twitter_tokens')
      .select('twitter_handle, connected_at, token_expiry')
      .eq('user_id', user.id)
      .single()

    if (!token) {
      return NextResponse.json({ connected: false })
    }

    const expired = token.token_expiry ? new Date(token.token_expiry) <= new Date() : false

    return NextResponse.json({
      connected: true,
      handle: token.twitter_handle,
      connectedAt: token.connected_at,
      expired,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
