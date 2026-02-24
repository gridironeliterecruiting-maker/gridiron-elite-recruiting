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

    return NextResponse.json({
      debug: true,
      appUrl,
      redirectUri,
      clientId: clientId.substring(0, 8) + '...' + clientId.substring(clientId.length - 4),
      clientSecretStatus: clientSecret,
      scopes: 'dm.read dm.write tweet.read users.read offline.access',
      codeChallenge: codeChallenge.substring(0, 10) + '...',
      stateEncoded: Buffer.from(state).toString('base64url').substring(0, 30) + '...',
      fullOAuthUrl: url,
      instructions: {
        step1: 'Verify the redirectUri above EXACTLY matches what you entered in X Developer Portal → OAuth 2.0 → Callback URL',
        step2: 'Verify clientId matches your X app Client ID',
        step3: 'In X Developer Portal, check if your app type is "Confidential Client" (required for offline.access)',
        step4: 'If app type is "Public Client", offline.access scope will cause "Something went wrong"',
      }
    }, { status: 200 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
