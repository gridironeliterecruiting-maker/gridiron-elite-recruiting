import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { refreshTwitterToken } from '@/lib/twitter'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data: token } = await admin
      .from('twitter_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!token) {
      return NextResponse.json({ error: 'No Twitter token found' }, { status: 404 })
    }

    if (!token.refresh_token) {
      return NextResponse.json({ error: 'No refresh token — re-authorize required' }, { status: 400 })
    }

    // Check if still valid
    if (token.token_expiry && new Date(token.token_expiry) > new Date()) {
      return NextResponse.json({ success: true, refreshed: false, expiresAt: token.token_expiry })
    }

    const refreshed = await refreshTwitterToken(token.refresh_token)
    const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()

    await admin
      .from('twitter_tokens')
      .update({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token || token.refresh_token,
        token_expiry: newExpiry,
        updated_at: new Date().toISOString(),
      })
      .eq('id', token.id)

    return NextResponse.json({ success: true, refreshed: true, expiresAt: newExpiry })
  } catch (error) {
    console.error('Twitter refresh error:', error)
    return NextResponse.json({ error: 'Failed to refresh token' }, { status: 500 })
  }
}
