import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { refreshGmailToken } from '@/lib/gmail'

export async function POST() {
  console.log('[Gmail Refresh] Endpoint called')
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      console.log('[Gmail Refresh] No user found - returning 401')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    console.log('[Gmail Refresh] User:', user.email)

    // Get user's Gmail token
    const { data: gmailToken, error: tokenError } = await supabase
      .from('gmail_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (tokenError || !gmailToken) {
      return NextResponse.json({ error: 'No Gmail token found' }, { status: 404 })
    }

    // Check if token is expired
    const tokenExpiry = new Date(gmailToken.token_expiry)
    const now = new Date()
    
    if (tokenExpiry > now) {
      // Token is still valid
      return NextResponse.json({ 
        success: true, 
        email: gmailToken.email,
        expiresAt: gmailToken.token_expiry
      })
    }

    // Try to refresh the token
    try {
      const refreshed = await refreshGmailToken(gmailToken.refresh_token)
      const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000)
      
      // Update the token in the database
      const { error: updateError } = await supabase
        .from('gmail_tokens')
        .update({
          access_token: refreshed.access_token,
          token_expiry: newExpiry.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', gmailToken.id)

      if (updateError) {
        console.error('Failed to update token:', updateError)
        return NextResponse.json({ error: 'Failed to update token' }, { status: 500 })
      }

      return NextResponse.json({ 
        success: true, 
        email: gmailToken.email,
        expiresAt: newExpiry.toISOString(),
        refreshed: true
      })
    } catch (refreshError) {
      // Refresh failed - need to re-authenticate
      console.error('Token refresh failed:', refreshError)
      return NextResponse.json({ 
        error: 'Token refresh failed', 
        needsReauth: true 
      }, { status: 401 })
    }
  } catch (error) {
    console.error('Gmail refresh error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}