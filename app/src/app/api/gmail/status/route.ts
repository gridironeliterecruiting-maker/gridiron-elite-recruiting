import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: token } = await supabase
      .from('gmail_tokens')
      .select('email, connected_at')
      .eq('user_id', user.id)
      .single()

    if (!token) {
      return NextResponse.json({ connected: false })
    }

    return NextResponse.json({
      connected: true,
      email: token.email,
      connectedAt: token.connected_at,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
