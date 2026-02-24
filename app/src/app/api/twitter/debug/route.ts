import { NextRequest, NextResponse } from 'next/server'
import { getAppUrl } from '@/lib/app-url'

// Public debug endpoint — only shows env var presence (true/false), no secret values
export async function GET(request: NextRequest) {
  const appUrl = getAppUrl(request)

  const envCheck = {
    TWITTER_CLIENT_ID: !!process.env.TWITTER_CLIENT_ID,
    TWITTER_CLIENT_SECRET: !!process.env.TWITTER_CLIENT_SECRET,
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
    VERCEL: process.env.VERCEL || 'not set',
    NODE_ENV: process.env.NODE_ENV || 'not set',
  }

  const twitterEnvKeys = Object.keys(process.env).filter(k =>
    k.toUpperCase().includes('TWITTER')
  )

  return NextResponse.json({
    envCheck,
    twitterEnvKeysFound: twitterEnvKeys,
    totalEnvVarCount: Object.keys(process.env).length,
    redirectUri: `${appUrl}/api/twitter/oauth-callback`,
    codeVersion: 'v8-no-env-block',
    deployTime: new Date().toISOString(),
  })
}
