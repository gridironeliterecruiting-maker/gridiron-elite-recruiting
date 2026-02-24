import { NextRequest, NextResponse } from 'next/server'
import { getAppUrl } from '@/lib/app-url'

// Debug endpoint — shows env var presence (true/false), no secret values
export async function GET(request: NextRequest) {
  const appUrl = getAppUrl(request)

  return NextResponse.json({
    envCheck: {
      TWITTER_CLIENT_ID: !!process.env.TWITTER_CLIENT_ID,
      TWITTER_CLIENT_SECRET: !!process.env.TWITTER_CLIENT_SECRET,
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
    },
    twitterIdLength: (process.env.TWITTER_CLIENT_ID || '').length,
    twitterSecretLength: (process.env.TWITTER_CLIENT_SECRET || '').length,
    redirectUri: `${appUrl}/api/twitter/oauth-callback`,
    codeVersion: 'v18-clean',
    deployTime: new Date().toISOString(),
  })
}
