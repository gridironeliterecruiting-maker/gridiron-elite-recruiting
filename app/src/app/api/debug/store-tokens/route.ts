import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: { session } } = await supabase.auth.getSession()

  if (!user || !session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  if (!session.provider_token) {
    return NextResponse.json({ error: 'No provider token in session' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Store/update Gmail tokens
  const { error } = await admin.from('gmail_tokens').upsert({
    user_id: user.id,
    access_token: session.provider_token,
    refresh_token: session.provider_refresh_token || '',
    token_expiry: new Date(Date.now() + 3600 * 1000).toISOString(),
    email: user.email || '',
    connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    email: user.email,
    has_access_token: true,
    has_refresh_token: !!session.provider_refresh_token,
    message: 'Gmail tokens stored. You can now send test emails.',
  })
}
