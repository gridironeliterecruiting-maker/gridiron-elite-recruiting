import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clientId = process.env.GOOGLE_CLIENT_ID!.trim()
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL!.trim()}/api/gmail/oauth-callback`

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email',
      access_type: 'offline',
      prompt: 'consent',
      state: user.id, // Pass user ID for verification
    })

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`

    return NextResponse.redirect(url)
  } catch (error) {
    console.error('Gmail authorize error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
