import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendGmailEmail, refreshGmailToken } from '@/lib/gmail'
import { getAppUrl } from '@/lib/app-url'
import { NextResponse } from 'next/server'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') return null
  return user
}

// POST /api/admin/programs/[id]/members - Add a member
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const supabase = await createClient()
    const user = await requireAdmin(supabase)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { email, role } = await request.json()
    if (!email || !role) {
      return NextResponse.json({ error: 'Email and role are required' }, { status: 400 })
    }
    if (!['coach', 'player'].includes(role)) {
      return NextResponse.json({ error: 'Role must be coach or player' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Check if member already exists
    const { data: existing } = await admin
      .from('program_members')
      .select('id')
      .eq('program_id', id)
      .ilike('email', email.trim())
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'This email is already a member of this program' }, { status: 409 })
    }

    const { data: member, error } = await admin
      .from('program_members')
      .insert({
        program_id: id,
        email: email.trim().toLowerCase(),
        role,
      })
      .select()
      .single()

    if (error) {
      console.error('Error adding member:', error)
      return NextResponse.json({ error: 'Failed to add member' }, { status: 500 })
    }

    // Send "you've been granted access" email — best-effort, never fails the request
    sendWelcomeEmail(admin, id, email.trim().toLowerCase(), role).catch(err => {
      console.error('Welcome email failed (non-fatal):', err)
    })

    return NextResponse.json({ member }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/admin/programs/[id]/members:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function sendWelcomeEmail(
  admin: ReturnType<typeof createAdminClient>,
  programId: string,
  memberEmail: string,
  role: string
) {
  // Get program details
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

  // Always use the admin Gmail token — system emails send from gridironeliterecruiting@gmail.com
  const { data: gmailToken } = await admin
    .from('gmail_tokens')
    .select('user_id, access_token, refresh_token, token_expiry, profiles!inner(role)')
    .eq('profiles.role', 'admin')
    .limit(1)
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
      <h1 style="font-size: 24px; font-weight: 700; color: #111; margin: 0 0 12px 0;">You've Been Granted Access</h1>
      <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 32px 0;">
        You have been added to the <strong>${programName}</strong> ${roleLabel} on Gridiron Elite Recruiting.
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
    `You've been added to ${programName} on Gridiron Elite Recruiting`,
    htmlBody,
  )
}

// DELETE /api/admin/programs/[id]/members - Remove a member
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const supabase = await createClient()
    const user = await requireAdmin(supabase)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { memberId } = await request.json()
    if (!memberId) {
      return NextResponse.json({ error: 'Member ID is required' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { error } = await admin
      .from('program_members')
      .delete()
      .eq('id', memberId)
      .eq('program_id', id)

    if (error) {
      console.error('Error removing member:', error)
      return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/admin/programs/[id]/members:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
