import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getWorkspaceGmailAccessToken } from '@/lib/workspace'
import { sendGmailEmail } from '@/lib/gmail'
import { getAppUrl } from '@/lib/app-url'

export async function POST(request: Request) {
  const { username } = await request.json()

  if (!username) {
    return NextResponse.json({ error: 'Username is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Look up the workspace email + recovery email by username
  const { data: profile } = await admin
    .from('profiles')
    .select('workspace_email, recovery_email, first_name')
    .eq('username', username.toLowerCase().trim())
    .single()

  // Always return success to avoid username enumeration
  if (!profile?.workspace_email) {
    return NextResponse.json({ success: true })
  }

  try {
    // Generate a Supabase password reset link
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: profile.workspace_email,
      options: {
        redirectTo: `${getAppUrl()}/auth/reset-password`,
      },
    })

    if (linkError || !linkData?.properties?.action_link) {
      console.error('[forgot-password] Failed to generate reset link:', linkError)
      return NextResponse.json({ success: true }) // Don't reveal error
    }

    const resetLink = linkData.properties.action_link
    const sendTo = profile.recovery_email || profile.workspace_email

    // Use a workspace service account email to send the reset link
    // We impersonate a Runway Recruit admin/noreply address
    const adminEmail = `noreply@${process.env.GOOGLE_WORKSPACE_DOMAIN || 'flightschoolmail.com'}`
    const accessToken = await getWorkspaceGmailAccessToken(adminEmail)

    const htmlBody = `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#333;max-width:500px;margin:0 auto;padding:24px;">
  <p>Hi ${profile.first_name || username},</p>
  <p>We received a request to reset your Runway Recruit password.</p>
  <p>Click the button below to set a new password. This link expires in 1 hour.</p>
  <p style="margin:24px 0;">
    <a href="${resetLink}" style="display:inline-block;background:#1a3a6e;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
      Reset Password
    </a>
  </p>
  <p style="color:#666;font-size:12px;">
    If you didn't request this, you can safely ignore this email. Your password won't change.
  </p>
  <p style="color:#666;font-size:12px;">— Runway Recruit</p>
</body>
</html>`

    await sendGmailEmail(accessToken, sendTo, 'Reset your Runway Recruit password', htmlBody, 'Runway Recruit', adminEmail)
  } catch (error) {
    console.error('[forgot-password] Failed to send reset email:', error)
    // Still return success to avoid enumeration
  }

  return NextResponse.json({ success: true })
}
