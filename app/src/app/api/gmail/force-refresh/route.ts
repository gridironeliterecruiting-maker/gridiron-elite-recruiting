import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Force refresh endpoint - accessible directly
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
    }

    // Get the Gmail token
    const admin = createAdminClient()
    const { data: gmailToken } = await admin
      .from('gmail_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!gmailToken) {
      return NextResponse.json({ error: 'No Gmail token found' }, { status: 404 })
    }

    if (!gmailToken.refresh_token) {
      return NextResponse.json({ error: 'No refresh token available' }, { status: 400 })
    }

    // Force refresh the token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: gmailToken.refresh_token,
        grant_type: 'refresh_token',
      }),
    })

    if (!tokenRes.ok) {
      const error = await tokenRes.text()
      return NextResponse.json({ 
        error: 'Failed to refresh token', 
        details: error 
      }, { status: 500 })
    }

    const tokens = await tokenRes.json()
    const newExpiry = new Date(Date.now() + (tokens.expires_in || 3600) * 1000)

    // Update the token
    const { error: updateError } = await admin
      .from('gmail_tokens')
      .update({
        access_token: tokens.access_token,
        token_expiry: newExpiry.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', gmailToken.id)

    if (updateError) {
      return NextResponse.json({ 
        error: 'Failed to save refreshed token',
        details: updateError 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Token refreshed successfully',
      expires_at: newExpiry.toISOString(),
      email: gmailToken.email
    })
  } catch (error) {
    console.error('Force refresh error:', error)
    return NextResponse.json({ 
      error: 'Internal error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}