import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendGmailEmail, refreshGmailToken } from '@/lib/gmail'
import { getAppUrl } from '@/lib/app-url'
import { NextResponse } from 'next/server'

// PATCH /api/access-requests/[id] — approve or deny an access request
// Caller must be a coach on the program associated with the request.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { action, role } = await request.json()
    if (!['approve', 'deny'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
    if (action === 'approve' && !['coach', 'player'].includes(role)) {
      return NextResponse.json({ error: 'Role required for approval' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Load the access request
    const { data: accessRequest } = await admin
      .from('access_requests')
      .select('id, user_id, user_email, user_name, program_id, status')
      .eq('id', id)
      .single()

    if (!accessRequest) return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    if (!accessRequest.program_id) return NextResponse.json({ error: 'Not a program request' }, { status: 400 })

    // Verify the caller is a coach on this program
    const { data: membership } = await admin
      .from('program_members')
      .select('role')
      .eq('program_id', accessRequest.program_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership || membership.role !== 'coach') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (action === 'deny') {
      await admin
        .from('access_requests')
        .update({ status: 'denied', updated_at: new Date().toISOString() })
        .eq('id', id)
      return NextResponse.json({ success: true })
    }

    // Approve — add to program_members if not already there
    const { data: existing } = await admin
      .from('program_members')
      .select('id')
      .eq('program_id', accessRequest.program_id)
      .ilike('email', accessRequest.user_email)
      .maybeSingle()

    if (!existing) {
      const { error: insertError } = await admin
        .from('program_members')
        .insert({
          program_id: accessRequest.program_id,
          email: accessRequest.user_email.toLowerCase(),
          role,
          user_id: accessRequest.user_id || null,
        })

      if (insertError) {
        console.error('Error adding member on approval:', insertError)
        return NextResponse.json({ error: 'Failed to add member' }, { status: 500 })
      }
    }

    // Update request status
    await admin
      .from('access_requests')
      .update({ status: 'approved', updated_at: new Date().toISOString() })
      .eq('id', id)

    // Send welcome email — best-effort, never fails the request
    sendWelcomeEmail(admin, accessRequest.program_id, accessRequest.user_email.toLowerCase(), role).catch(err => {
      console.error('Welcome email failed (non-fatal):', err)
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in PATCH /api/access-requests/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function sendWelcomeEmail(
  admin: ReturnType<typeof createAdminClient>,
  programId: string,
  memberEmail: string,
  role: string
) {
  const { data: program } = await admin
    .from('managed_programs')
    .select('school_name, mascot, landing_slug, logo_url, primary_color')
    .eq('id', programId)
    .single()

  if (!program?.landing_slug) return

  const programName = [program.school_name, program.mascot].filter(Boolean).join(' ')
  const baseUrl = getAppUrl()
  const loginUrl = `${baseUrl}/${program.landing_slug}`
  const logoUrl = program.logo_url
    ? (program.logo_url.startsWith('http') ? program.logo_url : `${baseUrl}${program.logo_url}`)
    : null

  const { data: gmailToken } = await admin
    .from('gmail_tokens')
    .select('user_id, access_token, refresh_token, token_expiry')
    .eq('email', 'gridironeliterecruiting@gmail.com')
    .single()

  if (!gmailToken) return

  let accessToken = gmailToken.access_token
  if (gmailToken.token_expiry && new Date(gmailToken.token_expiry) <= new Date()) {
    const refreshed = await refreshGmailToken(gmailToken.refresh_token)
    accessToken = refreshed.access_token
    await admin
      .from('gmail_tokens')
      .update({
        access_token: refreshed.access_token,
        token_expiry: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      })
      .eq('user_id', gmailToken.user_id)
  }

  const color = program.primary_color || '#1a3a6e'
  const roleLabel = role === 'coach' ? 'coaching staff' : 'portal'
  const htmlBody = `
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; text-align: center;">
      ${logoUrl ? `<img src="${logoUrl}" alt="${programName}" style="max-height: 80px; max-width: 200px; object-fit: contain; display: block; margin: 0 auto 16px;" />` : ''}
      <h2 style="color: ${color}; font-size: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 24px 0;">${programName}</h2>
      <h1 style="font-size: 24px; font-weight: 700; color: #111; margin: 0 0 12px 0;">You've Been Approved</h1>
      <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 32px 0;">
        Your request to join the <strong>${programName}</strong> ${roleLabel} on Gridiron Elite Recruiting has been approved.
        Click below to log in and get started.
      </p>
      <a href="${loginUrl}" style="display: inline-block; background-color: ${color}; color: #ffffff; font-weight: 700; font-size: 15px; padding: 14px 32px; border-radius: 8px; text-decoration: none; letter-spacing: 0.02em;">
        Access ${programName} Portal
      </a>
      <p style="color: #999; font-size: 12px; margin-top: 32px;">Powered by Gridiron Elite Recruiting</p>
    </div>
  `

  await sendGmailEmail(
    accessToken,
    memberEmail,
    `Your access to ${programName} has been approved`,
    htmlBody,
  )
}
