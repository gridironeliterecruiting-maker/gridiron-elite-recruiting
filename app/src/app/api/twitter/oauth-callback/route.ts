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

  console.log('[Twitter Callback] ===== START =====')
  console.log('[Twitter Callback] finalUrl:', finalUrl)
  console.log('[Twitter Callback] code present:', !!code)
  console.log('[Twitter Callback] error param:', error)
  console.log('[Twitter Callback] state present:', !!stateParam)

  // Parse state (try base64url first, then standard base64)
  let campaignId: string | null = null
  let returnTo: string | null = null
  let programId: string | null = null
  try {
    if (stateParam) {
      let stateJson: string
      try {
        stateJson = Buffer.from(stateParam, 'base64url').toString()
      } catch {
        stateJson = Buffer.from(stateParam, 'base64').toString()
      }
      const state = JSON.parse(stateJson)
      campaignId = state.campaignId
      returnTo = state.returnTo
      programId = state.programId || null
      console.log('[Twitter Callback] Parsed state - returnTo:', returnTo, 'campaignId:', campaignId, 'programId:', programId)
    }
  } catch (e) {
    console.error('[Twitter Callback] Failed to parse state:', e)
  }

  const redirectBase = returnTo
    ? `${finalUrl}${returnTo}`
    : campaignId
      ? `${finalUrl}/outreach?campaign=${campaignId}`
      : `${finalUrl}/outreach`

  if (error) {
    console.error('[Twitter Callback] Twitter returned error:', error)
    return NextResponse.redirect(`${redirectBase}${redirectBase.includes('?') ? '&' : '?'}twitter=error&reason=${encodeURIComponent(error)}`)
  }

  if (!code) {
    console.error('[Twitter Callback] No code in callback URL')
    return NextResponse.redirect(`${redirectBase}${redirectBase.includes('?') ? '&' : '?'}twitter=error&reason=no_code`)
  }

  // Read code_verifier from cookie
  const codeVerifier = request.cookies.get('twitter_code_verifier')?.value
  console.log('[Twitter Callback] code_verifier cookie present:', !!codeVerifier)
  if (!codeVerifier) {
    console.error('[Twitter Callback] Missing PKCE code_verifier cookie')
    console.log('[Twitter Callback] Available cookies:', request.cookies.getAll().map(c => c.name).join(', '))
    return NextResponse.redirect(`${redirectBase}${redirectBase.includes('?') ? '&' : '?'}twitter=error&reason=missing_verifier`)
  }

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    console.log('[Twitter Callback] Auth result - user:', user?.id || 'null', 'error:', authError?.message || 'none')

    if (!user) {
      console.error('[Twitter Callback] No authenticated user')
      return NextResponse.redirect(`${finalUrl}/login?redirect=/outreach`)
    }

    const redirectUri = `${finalUrl}/api/twitter/oauth-callback`
    console.log('[Twitter Callback] Token exchange redirect_uri:', redirectUri)
    console.log('[Twitter Callback] TWITTER_CLIENT_ID present:', !!process.env.TWITTER_CLIENT_ID)
    console.log('[Twitter Callback] TWITTER_CLIENT_SECRET present:', !!process.env.TWITTER_CLIENT_SECRET)

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code, codeVerifier, redirectUri)
    const { access_token, refresh_token, expires_in } = tokens

    console.log('[Twitter Callback] Token exchange success - access_token present:', !!access_token, 'refresh_token present:', !!refresh_token, 'expires_in:', expires_in)

    // Get user's Twitter profile
    const twitterUser = await getTwitterMe(access_token)
    console.log('[Twitter Callback] Twitter user:', twitterUser.id, '@' + twitterUser.username)

    const tokenExpiry = new Date(Date.now() + (expires_in || 7200) * 1000).toISOString()

    // Upsert tokens using admin client (bypasses RLS)
    const admin = createAdminClient()

    if (programId) {
      // Program-level token — store in program_twitter_tokens
      const { error: upsertError } = await admin
        .from('program_twitter_tokens')
        .upsert(
          {
            program_id: programId,
            twitter_user_id: twitterUser.id,
            twitter_handle: twitterUser.username,
            access_token,
            refresh_token: refresh_token || null,
            token_expiry: tokenExpiry,
            connected_at: new Date().toISOString(),
            connected_by: user.id,
          },
          { onConflict: 'program_id' }
        )

      if (upsertError) {
        console.error('[Twitter Callback] Program token upsert failed:', JSON.stringify(upsertError))
        return NextResponse.redirect(`${redirectBase}${redirectBase.includes('?') ? '&' : '?'}twitter=error&reason=store_failed`)
      }
    } else {
      // Per-user token — existing behaviour
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
        console.error('[Twitter Callback] Upsert failed:', JSON.stringify(upsertError))
        return NextResponse.redirect(`${redirectBase}${redirectBase.includes('?') ? '&' : '?'}twitter=error&reason=store_failed`)
      }
    }

    console.log(`[Twitter Callback] ===== SUCCESS ===== user=${user.id} handle=@${twitterUser.username}`)

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
    const message = err instanceof Error ? err.message : String(err)
    console.error('[Twitter Callback] ===== UNEXPECTED ERROR =====')
    console.error('[Twitter Callback] Message:', message)
    if (err instanceof Error && err.stack) {
      console.error('[Twitter Callback] Stack:', err.stack)
    }
    // Include a short error hint in the URL for debugging
    const shortReason = encodeURIComponent(message.slice(0, 200))
    return NextResponse.redirect(`${redirectBase}${redirectBase.includes('?') ? '&' : '?'}twitter=error&reason=${shortReason}`)
  }
}
