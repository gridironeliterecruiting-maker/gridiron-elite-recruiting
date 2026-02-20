import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { refreshGmailToken } from '@/lib/gmail'

export async function POST(request: Request) {
  // Security check: Verify cron secret
  const authHeader = request.headers.get('x-cron-secret')
  if (authHeader !== process.env.CRON_SECRET && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const admin = createAdminClient()
    
    // Get all Gmail tokens that have a refresh token
    const { data: tokens, error: fetchError } = await admin
      .from('gmail_tokens')
      .select('*')
      .not('refresh_token', 'is', null)

    if (fetchError) {
      console.error('[Cron Refresh] Failed to fetch tokens:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch tokens' }, { status: 500 })
    }

    if (!tokens || tokens.length === 0) {
      return NextResponse.json({ success: true, message: 'No tokens to refresh' })
    }

    console.log(`[Cron Refresh] Starting refresh for ${tokens.length} tokens...`)
    
    const results = {
      total: tokens.length,
      success: 0,
      failed: 0,
      errors: [] as any[]
    }

    for (const token of tokens) {
      try {
        const refreshed = await refreshGmailToken(token.refresh_token)
        const newExpiry = new Date(Date.now() + (refreshed.expires_in || 3600) * 1000)

        const { error: updateError } = await admin
          .from('gmail_tokens')
          .update({
            access_token: refreshed.access_token,
            token_expiry: newExpiry.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', token.id)

        if (updateError) {
          throw updateError
        }

        results.success++
      } catch (err) {
        console.error(`[Cron Refresh] Failed to refresh token for ${token.email}:`, err)
        results.failed++
        results.errors.push({ 
          email: token.email, 
          error: err instanceof Error ? err.message : 'Unknown error' 
        })
      }
    }

    return NextResponse.json({ 
      success: true, 
      results 
    })
  } catch (error) {
    console.error('[Cron Refresh] Unexpected error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
