import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const { email } = await request.json()

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Look up user by email to check their auth provider
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email.toLowerCase().trim())
    .single()

  if (!profile) {
    // Avoid enumeration — always return success
    return NextResponse.json({ success: true })
  }

  const { data: { user: authUser } } = await admin.auth.admin.getUserById(profile.id)

  if (!authUser) {
    return NextResponse.json({ success: true })
  }

  // Check if this is a Google-only account
  const isGoogleOnly =
    authUser.identities != null &&
    authUser.identities.length > 0 &&
    authUser.identities.every((i: any) => i.provider === 'google')

  if (isGoogleOnly) {
    return NextResponse.json({ googleUser: true })
  }

  // Email sending handled client-side via supabase.auth.resetPasswordForEmail
  return NextResponse.json({ success: true })
}
