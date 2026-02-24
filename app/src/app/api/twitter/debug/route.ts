import { NextRequest, NextResponse } from 'next/server'
import { getAppUrl } from '@/lib/app-url'
import { TWITTER_CLIENT_ID, TWITTER_CLIENT_SECRET, BUILD_TIMESTAMP } from '@/lib/twitter-env.generated'

// Public debug endpoint — only shows env var presence (true/false), no secret values
export async function GET(request: NextRequest) {
  const appUrl = getAppUrl(request)

  return NextResponse.json({
    envCheck: {
      TWITTER_CLIENT_ID_generated: !!TWITTER_CLIENT_ID,
      TWITTER_CLIENT_SECRET_generated: !!TWITTER_CLIENT_SECRET,
      TWITTER_CLIENT_ID_processEnv: !!process.env.TWITTER_CLIENT_ID,
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
      VERCEL: process.env.VERCEL || 'not set',
      NODE_ENV: process.env.NODE_ENV || 'not set',
    },
    generatedIdLength: TWITTER_CLIENT_ID.length,
    generatedSecretLength: TWITTER_CLIENT_SECRET.length,
    buildTimestamp: BUILD_TIMESTAMP,
    redirectUri: `${appUrl}/api/twitter/oauth-callback`,
    codeVersion: 'v12-nextconfig-gen',
    deployTime: new Date().toISOString(),
  })
}
