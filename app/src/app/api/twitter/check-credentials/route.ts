import { NextRequest, NextResponse } from 'next/server'

/**
 * Diagnostic endpoint to verify Twitter OAuth2 credentials are valid.
 * Makes a dummy token request — if credentials are valid, Twitter returns
 * "invalid_request" (bad code). If credentials are wrong, it returns
 * "unauthorized_client" (bad auth header).
 *
 * DELETE THIS ENDPOINT once Twitter OAuth is working.
 */
export async function GET(request: NextRequest) {
  const clientId = (process.env.TWITTER_CLIENT_ID || '').trim()
  const clientSecret = (process.env.TWITTER_CLIENT_SECRET || '').trim()

  if (!clientId || !clientSecret) {
    return NextResponse.json({
      status: 'missing',
      message: 'TWITTER_CLIENT_ID or TWITTER_CLIENT_SECRET env var is empty',
      clientIdLength: clientId.length,
      clientSecretLength: clientSecret.length,
    })
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  // Send a dummy token request — we expect it to fail, but HOW it fails tells us
  // whether the credentials are valid
  const res = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      code: 'test_dummy_code',
      grant_type: 'authorization_code',
      redirect_uri: 'https://gridironeliterecruiting.com/api/twitter/oauth-callback',
      code_verifier: 'test_dummy_verifier',
    }),
  })

  const body = await res.text()
  let parsed: Record<string, unknown> = {}
  try { parsed = JSON.parse(body) } catch { parsed = { raw: body } }

  // If Twitter says "invalid_request" or "invalid_grant" → credentials are VALID (bad code is expected)
  // If Twitter says "unauthorized_client" → credentials are WRONG
  const error = parsed.error as string || ''
  const credentialsValid = error !== 'unauthorized_client'

  return NextResponse.json({
    credentialsValid,
    twitterResponse: parsed,
    twitterStatus: res.status,
    clientIdLength: clientId.length,
    clientIdPrefix: clientId.substring(0, 8),
    clientSecretLength: clientSecret.length,
    clientSecretPrefix: clientSecret.substring(0, 4),
    basicAuthLength: basicAuth.length,
  })
}
