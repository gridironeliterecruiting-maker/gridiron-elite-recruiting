import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGmailAddress } from '@/lib/gmail'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { provider_token, provider_refresh_token } = await request.json()

    if (!provider_token) {
      return NextResponse.json({ error: 'Missing provider_token' }, { status: 400 })
    }

    // Get the Gmail address associated with this token
    let email: string
    try {
      email = await getGmailAddress(provider_token)
    } catch {
      return NextResponse.json({ error: 'Failed to verify Gmail access. Please reconnect.' }, { status: 400 })
    }

    // Calculate token expiry (Google tokens last ~1 hour)
    const tokenExpiry = new Date(Date.now() + 3600 * 1000).toISOString()

    // Upsert token record
    const { error: upsertError } = await supabase
      .from('gmail_tokens')
      .upsert(
        {
          user_id: user.id,
          access_token: provider_token,
          refresh_token: provider_refresh_token || '',
          token_expiry: tokenExpiry,
          email,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

    if (upsertError) {
      console.error('Failed to store Gmail tokens:', upsertError)
      return NextResponse.json({ error: 'Failed to store tokens' }, { status: 500 })
    }

    return NextResponse.json({ success: true, email })
  } catch (error) {
    console.error('Store tokens error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
