import { NextRequest, NextResponse } from 'next/server'
import { getAppUrl } from '@/lib/app-url'
import { TWITTER_CLIENT_ID as GEN_ID, TWITTER_CLIENT_SECRET as GEN_SECRET, BUILD_TIMESTAMP as GEN_TS } from '@/lib/_twitter-build-config'

// Public debug endpoint — only shows env var presence (true/false), no secret values
export async function GET(request: NextRequest) {
  const appUrl = getAppUrl(request)

  // Strategy 1: generated module (import from _twitter-build-config.ts)
  const genId = GEN_ID
  const genSecret = GEN_SECRET

  // Strategy 2: next.config env property (inlined by Next.js at build time)
  const envId = process.env.TWITTER_CLIENT_ID || ''
  const envSecret = process.env.TWITTER_CLIENT_SECRET || ''

  return NextResponse.json({
    strategy1_generatedModule: {
      idLength: genId.length,
      secretLength: genSecret.length,
      buildTimestamp: GEN_TS,
    },
    strategy2_nextConfigEnv: {
      idLength: envId.length,
      secretLength: envSecret.length,
      buildTimestamp: process.env.TWITTER_BUILD_TIMESTAMP || 'not set',
    },
    envCheck: {
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
      VERCEL: process.env.VERCEL || 'not set',
      NODE_ENV: process.env.NODE_ENV || 'not set',
    },
    redirectUri: `${appUrl}/api/twitter/oauth-callback`,
    codeVersion: 'v14-dual-strategy',
    deployTime: new Date().toISOString(),
  })
}
