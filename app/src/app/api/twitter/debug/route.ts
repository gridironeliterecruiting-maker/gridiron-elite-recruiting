import { NextRequest, NextResponse } from 'next/server'
import { getAppUrl } from '@/lib/app-url'
import { TWITTER_CLIENT_ID, TWITTER_CLIENT_SECRET, BUILD_TIMESTAMP } from '@/lib/_twitter-build-config'

// Debug endpoint — shows env var presence (true/false), no secret values
export async function GET(request: NextRequest) {
  const appUrl = getAppUrl(request)

  return NextResponse.json({
    envCheck: {
      TWITTER_CLIENT_ID: !!TWITTER_CLIENT_ID,
      TWITTER_CLIENT_SECRET: !!TWITTER_CLIENT_SECRET,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
    },
    twitterIdLength: TWITTER_CLIENT_ID.length,
    twitterSecretLength: TWITTER_CLIENT_SECRET.length,
    buildTimestamp: BUILD_TIMESTAMP,
    redirectUri: `${appUrl}/api/twitter/oauth-callback`,
    codeVersion: 'v19-charcode',
    deployTime: new Date().toISOString(),
  })
}
