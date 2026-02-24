import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAppUrl } from '@/lib/app-url'
import { generateCodeVerifier, generateCodeChallenge } from '@/lib/twitter'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clientId = process.env.TWITTER_CLIENT_ID || 'NOT SET'
    const clientSecret = process.env.TWITTER_CLIENT_SECRET ? 'SET (hidden)' : 'NOT SET'
    const appUrl = getAppUrl(request)
    const redirectUri = `${appUrl}/api/twitter/oauth-callback`

    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)

    const state = JSON.stringify({
      userId: user.id,
      campaignId: null,
      returnTo: '/dashboard',
    })

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'dm.read dm.write tweet.read users.read offline.access',
      state: Buffer.from(state).toString('base64url'),
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    })

    const url = `https://twitter.com/i/oauth2/authorize?${params.toString()}`

    // Check which env vars exist (just presence, not values)
    const envCheck = {
      TWITTER_CLIENT_ID: !!process.env.TWITTER_CLIENT_ID,
      TWITTER_CLIENT_SECRET: !!process.env.TWITTER_CLIENT_SECRET,
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
      VERCEL: process.env.VERCEL || 'not set',
      NODE_ENV: process.env.NODE_ENV || 'not set',
    }

    return NextResponse.json({
      debug: true,
      appUrl,
      redirectUri,
      clientId: clientId.substring(0, 8) + '...' + clientId.substring(clientId.length - 4),
      clientSecretStatus: clientSecret,
      envCheck,
      rawClientId: process.env.TWITTER_CLIENT_ID === undefined ? 'undefined' : process.env.TWITTER_CLIENT_ID === '' ? 'empty string' : 'has value',
      deployTime: new Date().toISOString(),
    }, { status: 200 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
