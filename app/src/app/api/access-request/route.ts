import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendGmailEmail, refreshGmailToken } from '@/lib/gmail'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { coachProfileId, programId, adminRequest } = body

    const admin = createAdminClient()

    // Get the requesting user's profile
    const { data: requesterProfile } = await admin
      .from('profiles')
      .select('first_name, last_name, email')
      .eq('id', user.id)
      .single()

    const requesterName = [requesterProfile?.first_name, requesterProfile?.last_name]
      .filter(Boolean).join(' ') || 'Unknown User'
    const requesterEmail = requesterProfile?.email || user.email || ''

    // ── Admin access request ──
    if (adminRequest) {
      const { error: insertError } = await admin
        .from('access_requests')
        .upsert({
          user_id: user.id,
          user_email: requesterEmail,
          user_name: requesterName,
          request_type: 'admin',
          status: 'pending',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,coach_profile_id' })

      if (insertError) {
        console.error('Error creating admin access request:', insertError)
        return NextResponse.json({ error: 'Failed to create request' }, { status: 500 })
      }

      // Email all admin users
      await notifyAdmins(admin, requesterName, requesterEmail)

      return NextResponse.json({ success: true })
    }

    // ── Program access request (managed_programs) ──
    if (programId) {
      const { data: program } = await admin
        .from('managed_programs')
        .select('id, school_name, mascot')
        .eq('id', programId)
        .single()

      if (!program) {
        return NextResponse.json({ error: 'Program not found' }, { status: 404 })
      }

      const programName = [program.school_name, program.mascot].filter(Boolean).join(' ')

      const { error: insertError } = await admin
        .from('access_requests')
        .upsert({
          user_id: user.id,
          user_email: requesterEmail,
          user_name: requesterName,
          program_id: programId,
          request_type: 'program',
          status: 'pending',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,coach_profile_id' })

      if (insertError) {
        console.error('Error creating program access request:', insertError)
        return NextResponse.json({ error: 'Failed to create request' }, { status: 500 })
      }

      // Notify program coaches
      const { data: coachMembers } = await admin
        .from('program_members')
        .select('email, user_id')
        .eq('program_id', programId)
        .eq('role', 'coach')

      if (coachMembers) {
        for (const coach of coachMembers) {
          if (coach.user_id) {
            await sendNotificationEmail(admin, coach.user_id, coach.email, requesterName, requesterEmail, programName)
          }
        }
      }

      return NextResponse.json({ success: true })
    }

    // ── Legacy coach_profiles access request ──
    if (coachProfileId) {
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

      const { error: insertError } = await admin
        .from('access_requests')
        .upsert({
          user_id: user.id,
          user_email: requesterEmail,
          user_name: requesterName,
          coach_profile_id: coachProfileId,
          request_type: 'program',
          status: 'pending',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,coach_profile_id' })

      if (insertError) {
        console.error('Error creating access request:', insertError)
        return NextResponse.json({ error: 'Failed to create request' }, { status: 500 })
      }

      if (coachUser?.email) {
        await sendNotificationEmail(admin, coachProfileId, coachUser.email, requesterName, requesterEmail, coachProfile.program_name)
      }

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  } catch (error) {
    console.error('Unexpected error in POST /api/access-request:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Send a system notification email using the admin Gmail account.
// All internal notifications (access requests, welcome emails, etc.) send
// from gridironeliterecruiting@gmail.com — no per-user token needed.
async function sendNotificationEmail(
  admin: ReturnType<typeof createAdminClient>,
  _userId: string,  // kept for call-site compatibility, no longer used for token lookup
  toEmail: string,
  requesterName: string,
  requesterEmail: string,
  programName: string
) {
  try {
    // Always use the admin Gmail token for system notifications.
    // Query gmail_tokens directly joined to admin profiles so we only get
    // admins who actually have a connected token.
    const { data: gmailToken } = await admin
      .from('gmail_tokens')
      .select('user_id, access_token, refresh_token, token_expiry')
      .eq('email', 'gridironeliterecruiting@gmail.com')
      .single()

    if (!gmailToken) return

    const accessToken = gmailToken.access_token

    const htmlBody = `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333; margin-bottom: 4px;">New Access Request</h2>
        <p style="color: #666; margin-top: 0;">Someone wants to join ${programName} on Runway Elite Recruiting.</p>
        <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0 0 8px 0;"><strong>Name:</strong> ${requesterName}</p>
          <p style="margin: 0;"><strong>Email:</strong> ${requesterEmail}</p>
        </div>
        <p style="color: #666; font-size: 14px;">
          Log in to your Runway Elite Recruiting dashboard to approve or deny this request.
        </p>
      </div>
    `

    await sendGmailEmail(
      accessToken,
      toEmail,
      `Access Request: ${requesterName} wants to join ${programName}`,
      htmlBody,
      'Runway Elite Recruiting',
      toEmail
    )
  } catch (emailError) {
    console.error('Failed to send access request email:', emailError)
  }
}

// Notify all admin users about a platform admin access request
async function notifyAdmins(
  admin: ReturnType<typeof createAdminClient>,
  requesterName: string,
  requesterEmail: string
) {
  try {
    const { data: admins } = await admin
      .from('profiles')
      .select('id, email')
      .eq('role', 'admin')

    if (!admins) return

    for (const adm of admins) {
      if (adm.email) {
        await sendNotificationEmail(admin, adm.id, adm.email, requesterName, requesterEmail, 'Platform Administration')
      }
    }
  } catch (err) {
    console.error('Failed to notify admins:', err)
  }
}
