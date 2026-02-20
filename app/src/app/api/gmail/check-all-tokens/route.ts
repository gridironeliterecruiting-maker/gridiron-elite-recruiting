import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { refreshGmailToken } from '@/lib/gmail'

/**
 * Check and refresh all user Gmail tokens
 * Returns detailed status for each user
 */
export async function POST(request: Request) {
  // Security check: Verify cron secret or admin auth
  const authHeader = request.headers.get('x-cron-secret')
  const adminKey = request.headers.get('x-admin-key')
  
  if (process.env.NODE_ENV === 'production') {
    if (authHeader !== process.env.CRON_SECRET && adminKey !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const admin = createAdminClient()
    
    // Get all Gmail tokens
    const { data: tokens, error: fetchError } = await admin
      .from('gmail_tokens')
      .select('*')
      .order('email')

    if (fetchError) {
      console.error('[Check All Tokens] Failed to fetch tokens:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch tokens' }, { status: 500 })
    }

    if (!tokens || tokens.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No tokens found',
        results: []
      })
    }

    console.log(`[Check All Tokens] Checking ${tokens.length} tokens...`)
    
    const results = []
    const now = new Date()

    for (const token of tokens) {
      const tokenExpiry = new Date(token.token_expiry)
      const hoursUntilExpiry = (tokenExpiry.getTime() - now.getTime()) / (1000 * 60 * 60)
      
      const result = {
        email: token.email,
        user_id: token.user_id,
        expires_at: token.token_expiry,
        hours_until_expiry: Math.round(hoursUntilExpiry * 10) / 10,
        status: 'valid' as string,
        refreshed: false,
        error: null as string | null
      }

      // Check if token is expired or will expire soon (within 10 minutes)
      if (hoursUntilExpiry <= 0.17) { // 10 minutes
        result.status = hoursUntilExpiry <= 0 ? 'expired' : 'expiring_soon'
        
        // Only refresh if we have a refresh token
        if (!token.refresh_token) {
          result.status = 'no_refresh_token'
          result.error = 'Cannot refresh - no refresh token available'
        } else {
          try {
            console.log(`[Check All Tokens] Refreshing token for ${token.email}...`)
            
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

            result.status = 'refreshed'
            result.refreshed = true
            result.expires_at = newExpiry.toISOString()
            result.hours_until_expiry = Math.round((refreshed.expires_in || 3600) / 360) / 10
            
            console.log(`[Check All Tokens] Successfully refreshed token for ${token.email}`)
          } catch (err) {
            console.error(`[Check All Tokens] Failed to refresh token for ${token.email}:`, err)
            result.status = 'refresh_failed'
            result.error = err instanceof Error ? err.message : 'Unknown error'
          }
        }
      }
      
      results.push(result)
    }

    // Summary stats
    const summary = {
      total: results.length,
      valid: results.filter(r => r.status === 'valid').length,
      refreshed: results.filter(r => r.refreshed).length,
      expired: results.filter(r => r.status === 'expired').length,
      expiring_soon: results.filter(r => r.status === 'expiring_soon').length,
      no_refresh_token: results.filter(r => r.status === 'no_refresh_token').length,
      refresh_failed: results.filter(r => r.status === 'refresh_failed').length,
    }

    return NextResponse.json({ 
      success: true,
      summary,
      results
    })
  } catch (error) {
    console.error('[Check All Tokens] Unexpected error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET method for easy browser access (read-only status check)
export async function GET(request: Request) {
  // Same auth check
  const authHeader = request.headers.get('x-cron-secret')
  const adminKey = request.headers.get('x-admin-key')
  
  if (process.env.NODE_ENV === 'production') {
    if (authHeader !== process.env.CRON_SECRET && adminKey !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const admin = createAdminClient()
    
    // Just return status, don't refresh
    const { data: tokens, error: fetchError } = await admin
      .from('gmail_tokens')
      .select('email, token_expiry, refresh_token')
      .order('email')

    if (fetchError) {
      return NextResponse.json({ error: 'Failed to fetch tokens' }, { status: 500 })
    }

    const now = new Date()
    const results = tokens?.map(token => {
      const tokenExpiry = new Date(token.token_expiry)
      const hoursUntilExpiry = (tokenExpiry.getTime() - now.getTime()) / (1000 * 60 * 60)
      
      return {
        email: token.email,
        expires_at: token.token_expiry,
        hours_until_expiry: Math.round(hoursUntilExpiry * 10) / 10,
        status: hoursUntilExpiry <= 0 ? 'expired' : 
                hoursUntilExpiry <= 0.17 ? 'expiring_soon' : 'valid',
        has_refresh_token: !!token.refresh_token
      }
    }) || []

    return NextResponse.json({ 
      success: true,
      checked_at: now.toISOString(),
      tokens: results
    })
  } catch (error) {
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}