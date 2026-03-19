import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Returns whether a username belongs to a main_site registered user.
// Uses the admin client to bypass RLS — never exposes any user data,
// only returns a boolean. Safe to call unauthenticated.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const username = searchParams.get('username')?.trim().toLowerCase()

  if (!username) {
    return NextResponse.json({ allowed: false })
  }

  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('profiles')
      .select('id')
      .eq('username', username)
      .eq('registered_via', 'main_site')
      .maybeSingle()

    return NextResponse.json({ allowed: !!data })
  } catch (error) {
    console.error('[check-main-site-user]', error)
    return NextResponse.json({ allowed: false })
  }
}
