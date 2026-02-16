import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const stateParam = searchParams.get('state')
  // Use Vercel preview URL if available, otherwise production URL
  const appUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : (process.env.NEXT_PUBLIC_APP_URL || 'https://gridironeliterecruiting.com')
  const finalUrl = appUrl.trim()

  // Parse state to get campaign ID
  let campaignId = null
  try {
    if (stateParam) {
      const stateJson = Buffer.from(stateParam, 'base64').toString()
      const state = JSON.parse(stateJson)
      campaignId = state.campaignId
    }
  } catch (e) {
    console.error('Failed to parse OAuth state:', e)
  }

  if (error) {
    console.error('Gmail OAuth error:', error)
    const redirectUrl = campaignId 
      ? `${finalUrl}/outreach?campaign=${campaignId}&gmail=error&reason=${encodeURIComponent(error)}`
      : `${finalUrl}/outreach?gmail=error&reason=${encodeURIComponent(error)}`
    return NextResponse.redirect(redirectUrl)
  }

  if (!code) {
    const redirectUrl = campaignId 
      ? `${finalUrl}/outreach?campaign=${campaignId}&gmail=error&reason=no_code`
      : `${finalUrl}/outreach?gmail=error&reason=no_code`
    return NextResponse.redirect(redirectUrl)
  }

  try {
    // Get current logged-in user from Supabase cookies
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(`${finalUrl}/login?redirect=/outreach`)
    }

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
        client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
        redirect_uri: `${finalUrl}/api/gmail/oauth-callback`,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      const tokenError = await tokenRes.text()
      console.error('Token exchange failed:', tokenError)
      return NextResponse.redirect(`${finalUrl}/outreach?gmail=error&reason=token_exchange_failed`)
    }

    const tokens = await tokenRes.json()
    const { access_token, refresh_token, expires_in } = tokens

    if (!refresh_token) {
      console.warn('No refresh token received — user may need to revoke and re-authorize')
    }

    // Get user email from Google
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    })

    if (!userInfoRes.ok) {
      console.error('Failed to get user info')
      return NextResponse.redirect(`${finalUrl}/outreach?gmail=error&reason=userinfo_failed`)
    }

    const userInfo = await userInfoRes.json()
    const email = userInfo.email

    // Determine account tier based on Supabase account age
    const createdAt = new Date(user.created_at)
    const daysSinceCreation = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
    const accountTier = daysSinceCreation >= 90 ? 'veteran' : daysSinceCreation >= 30 ? 'established' : daysSinceCreation >= 14 ? 'building' : 'new'

    // Token expiry
    const tokenExpiry = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString()

    // Upsert tokens using admin client (bypasses RLS)
    const admin = createAdminClient()
    const { error: upsertError } = await admin
      .from('gmail_tokens')
      .upsert(
        {
          user_id: user.id,
          access_token,
          refresh_token: refresh_token || '',
          token_expiry: tokenExpiry,
          email,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          account_tier: accountTier,
        },
        { onConflict: 'user_id' }
      )

    if (upsertError) {
      console.error('Failed to store Gmail tokens:', upsertError)
      const redirectUrl = campaignId 
        ? `${finalUrl}/outreach?campaign=${campaignId}&gmail=error&reason=store_failed`
        : `${finalUrl}/outreach?gmail=error&reason=store_failed`
      return NextResponse.redirect(redirectUrl)
    }

    console.log(`Gmail connected for user ${user.id} (${email}), tier: ${accountTier}`)
    
    // If we have a campaign ID, redirect to the campaign editor
    const successUrl = campaignId 
      ? `${finalUrl}/outreach?campaign=${campaignId}&gmail=connected&resume=launch`
      : `${finalUrl}/outreach?gmail=connected`
    
    return NextResponse.redirect(successUrl)
  } catch (err) {
    console.error('Gmail OAuth callback error:', err)
    const redirectUrl = campaignId 
      ? `${finalUrl}/outreach?campaign=${campaignId}&gmail=error&reason=unexpected`
      : `${finalUrl}/outreach?gmail=error&reason=unexpected`
    return NextResponse.redirect(redirectUrl)
  }
}
