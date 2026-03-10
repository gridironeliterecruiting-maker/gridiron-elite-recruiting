import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAppUrl } from '@/lib/app-url'

export async function POST(request: Request) {
  const { username } = await request.json()

  if (!username) {
    return NextResponse.json({ error: 'Username is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Look up the workspace email by username
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
    // Use Supabase's built-in password reset — sends to the auth email (workspace_email)
    // The user set a recovery_email at signup; Supabase sends to workspace_email by default.
    // TODO: Once noreply@jetstreammail.com is provisioned, send custom email to recovery_email instead.
    await admin.auth.admin.generateLink({
      type: 'recovery',
      email: profile.workspace_email,
      options: {
        redirectTo: `${getAppUrl()}/auth/reset-password`,
      },
    })
  } catch (error) {
    console.error('[forgot-password] Failed to generate reset link:', error)
  }

  return NextResponse.json({ success: true })
}
