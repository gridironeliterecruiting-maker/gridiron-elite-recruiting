import { NextRequest, NextResponse } from 'next/server'
import { getAppUrl } from '@/lib/app-url'
import { getTwitterClientId, getTwitterClientSecret, BUILD_TIMESTAMP } from '@/lib/_twitter-build-config'

// Debug endpoint — shows env var presence (true/false), no secret values
export async function GET(request: NextRequest) {
  const appUrl = getAppUrl(request)
  const id = getTwitterClientId()
  const secret = getTwitterClientSecret()

  return NextResponse.json({
    envCheck: {
      TWITTER_CLIENT_ID: !!id,
      TWITTER_CLIENT_SECRET: !!secret,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
    },
    twitterIdLength: id.length,
    twitterSecretLength: secret.length,
    buildTimestamp: BUILD_TIMESTAMP,
    redirectUri: `${appUrl}/api/twitter/oauth-callback`,
    codeVersion: 'v20-lazy-getter',
    deployTime: new Date().toISOString(),
  })
}
