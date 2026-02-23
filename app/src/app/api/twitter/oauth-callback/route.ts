import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAppUrl } from '@/lib/app-url'
import { exchangeCodeForTokens, getTwitterMe } from '@/lib/twitter'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const stateParam = searchParams.get('state')
  const finalUrl = getAppUrl(request)

  // Parse state
  let campaignId: string | null = null
  try {
    if (stateParam) {
      const stateJson = Buffer.from(stateParam, 'base64').toString()
      const state = JSON.parse(stateJson)
      campaignId = state.campaignId
    }
  } catch (e) {
    console.error('Failed to parse Twitter OAuth state:', e)
  }

  const redirectBase = campaignId
    ? `${finalUrl}/outreach?campaign=${campaignId}`
    : `${finalUrl}/outreach`

  if (error) {
    console.error('Twitter OAuth error:', error)
    return NextResponse.redirect(`${redirectBase}${redirectBase.includes('?') ? '&' : '?'}twitter=error&reason=${encodeURIComponent(error)}`)
  }

  if (!code) {
    return NextResponse.redirect(`${redirectBase}${redirectBase.includes('?') ? '&' : '?'}twitter=error&reason=no_code`)
  }

  // Read code_verifier from cookie
  const codeVerifier = request.cookies.get('twitter_code_verifier')?.value
  if (!codeVerifier) {
    console.error('Missing PKCE code_verifier cookie')
    return NextResponse.redirect(`${redirectBase}${redirectBase.includes('?') ? '&' : '?'}twitter=error&reason=missing_verifier`)
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(`${finalUrl}/login?redirect=/outreach`)
    }

    const redirectUri = `${finalUrl}/api/twitter/oauth-callback`

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code, codeVerifier, redirectUri)
    const { access_token, refresh_token, expires_in } = tokens

    // Get user's Twitter profile
    const twitterUser = await getTwitterMe(access_token)
    const tokenExpiry = new Date(Date.now() + (expires_in || 7200) * 1000).toISOString()

    // Upsert tokens using admin client (bypasses RLS)
    const admin = createAdminClient()
    const { error: upsertError } = await admin
      .from('twitter_tokens')
      .upsert(
        {
          user_id: user.id,
          twitter_user_id: twitterUser.id,
          twitter_handle: twitterUser.username,
          access_token,
          refresh_token: refresh_token || null,
          token_expiry: tokenExpiry,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

    if (upsertError) {
      console.error('Failed to store Twitter tokens:', upsertError)
      return NextResponse.redirect(`${redirectBase}${redirectBase.includes('?') ? '&' : '?'}twitter=error&reason=store_failed`)
    }

    console.log(`Twitter connected for user ${user.id} (@${twitterUser.username})`)

    const successUrl = `${redirectBase}${redirectBase.includes('?') ? '&' : '?'}twitter=connected`
    const response = NextResponse.redirect(successUrl)

    // Clear the PKCE cookie
    response.cookies.set('twitter_code_verifier', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/api/twitter/oauth-callback',
    })

    return response
  } catch (err) {
    console.error('Twitter OAuth callback error:', err)
    return NextResponse.redirect(`${redirectBase}${redirectBase.includes('?') ? '&' : '?'}twitter=error&reason=unexpected`)
  }
}
