import { NextRequest, NextResponse } from 'next/server'
import { getAppUrl } from '@/lib/app-url'
import * as buildConfig from '@/lib/_twitter-build-config'

// Public debug endpoint — only shows env var presence (true/false), no secret values
export async function GET(request: NextRequest) {
  const appUrl = getAppUrl(request)

  // Check every export from the generated module
  const moduleKeys = Object.keys(buildConfig)
  const moduleValues: Record<string, { type: string; length: number }> = {}
  for (const key of moduleKeys) {
    const val = (buildConfig as Record<string, unknown>)[key]
    moduleValues[key] = {
      type: typeof val,
      length: typeof val === 'string' ? val.length : -1,
    }
  }

  return NextResponse.json({
    generatedModule: {
      exportedKeys: moduleKeys,
      values: moduleValues,
    },
    envConfig: {
      BAKED_TWITTER_CLIENT_ID: (process.env.BAKED_TWITTER_CLIENT_ID || '').length,
      BAKED_TWITTER_CLIENT_SECRET: (process.env.BAKED_TWITTER_CLIENT_SECRET || '').length,
      BAKED_TWITTER_BUILD_TIMESTAMP: process.env.BAKED_TWITTER_BUILD_TIMESTAMP || 'not set',
      TEST_ENV_CONSTANT: process.env.TEST_ENV_CONSTANT || 'not set',
    },
    envCheck: {
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
    },
    redirectUri: `${appUrl}/api/twitter/oauth-callback`,
    codeVersion: 'v17-diagnostic',
    deployTime: new Date().toISOString(),
  })
}
