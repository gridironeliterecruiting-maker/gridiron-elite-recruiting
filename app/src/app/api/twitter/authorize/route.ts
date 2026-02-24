import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAppUrl } from '@/lib/app-url'
import { generateCodeVerifier, generateCodeChallenge } from '@/lib/twitter'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaign')
    const returnTo = searchParams.get('returnTo')

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clientId = process.env.TWITTER_CLIENT_ID!
    const appUrl = getAppUrl(request)
    const redirectUri = `${appUrl}/api/twitter/oauth-callback`

    // PKCE
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)

    // State carries user context through OAuth
    const state = JSON.stringify({
      userId: user.id,
      campaignId: campaignId || null,
      returnTo: returnTo || null,
    })

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'dm.read dm.write tweet.read users.read offline.access',
      state: Buffer.from(state).toString('base64'),
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    })

    const url = `https://x.com/i/oauth2/authorize?${params.toString()}`
    console.log('[Twitter Authorize] Redirect URL:', url)
    console.log('[Twitter Authorize] Client ID:', clientId.substring(0, 8) + '...')
    console.log('[Twitter Authorize] Redirect URI:', redirectUri)

    // Store code_verifier in HttpOnly cookie for callback
    const response = NextResponse.redirect(url)
    response.cookies.set('twitter_code_verifier', codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/api/twitter/oauth-callback',
    })

    return response
  } catch (error) {
    console.error('Twitter authorize error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
