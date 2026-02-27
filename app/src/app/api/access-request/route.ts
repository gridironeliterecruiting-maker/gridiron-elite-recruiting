import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendGmailEmail, refreshGmailToken } from '@/lib/gmail'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { coachProfileId } = await request.json()
    if (!coachProfileId) {
      return NextResponse.json({ error: 'Missing coachProfileId' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Get the requesting user's profile info
    const { data: requesterProfile } = await admin
      .from('profiles')
      .select('first_name, last_name, email')
      .eq('id', user.id)
      .single()

    const requesterName = [requesterProfile?.first_name, requesterProfile?.last_name]
      .filter(Boolean).join(' ') || 'Unknown User'
    const requesterEmail = requesterProfile?.email || user.email || ''

    // Get the coach's profile and program info
    const { data: coachProfile } = await admin
      .from('coach_profiles')
      .select('id, program_name')
      .eq('id', coachProfileId)
      .single()

    if (!coachProfile) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 })
    }

    const { data: coachUser } = await admin
      .from('profiles')
      .select('email, first_name')
      .eq('id', coachProfileId)
      .single()

    // Insert the access request (upsert to handle re-requests)
    const { error: insertError } = await admin
      .from('access_requests')
      .upsert({
        user_id: user.id,
        user_email: requesterEmail,
        user_name: requesterName,
        coach_profile_id: coachProfileId,
        status: 'pending',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,coach_profile_id' })

    if (insertError) {
      console.error('Error creating access request:', insertError)
      return NextResponse.json({ error: 'Failed to create request' }, { status: 500 })
    }

    // Try to send an email notification to the coach via their Gmail
    if (coachUser?.email) {
      try {
        const { data: gmailToken } = await admin
          .from('gmail_tokens')
          .select('access_token, refresh_token, token_expiry')
          .eq('user_id', coachProfileId)
          .single()

        if (gmailToken) {
          let accessToken = gmailToken.access_token

          // Refresh token if expired
          if (gmailToken.token_expiry && new Date(gmailToken.token_expiry) <= new Date()) {
            const refreshed = await refreshGmailToken(gmailToken.refresh_token)
            accessToken = refreshed.access_token
            // Update stored token
            await admin
              .from('gmail_tokens')
              .update({
                access_token: refreshed.access_token,
                token_expiry: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
              })
              .eq('user_id', coachProfileId)
          }

          const htmlBody = `
            <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #333; margin-bottom: 4px;">New Access Request</h2>
              <p style="color: #666; margin-top: 0;">Someone wants to join your program on Gridiron Elite Recruiting.</p>
              <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="margin: 0 0 8px 0;"><strong>Name:</strong> ${requesterName}</p>
                <p style="margin: 0;"><strong>Email:</strong> ${requesterEmail}</p>
              </div>
              <p style="color: #666; font-size: 14px;">
                Log in to your Gridiron Elite Recruiting dashboard to approve or deny this request.
              </p>
            </div>
          `

          await sendGmailEmail(
            accessToken,
            coachUser.email,
            `Access Request: ${requesterName} wants to join ${coachProfile.program_name}`,
            htmlBody,
            'Gridiron Elite Recruiting',
            coachUser.email
          )
        }
      } catch (emailError) {
        // Email notification is best-effort — request is already stored in DB
        console.error('Failed to send access request email:', emailError)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error in POST /api/access-request:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
