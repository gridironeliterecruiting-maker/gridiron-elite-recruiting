import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Returns profile data for a main-site user by their recovery email,
// so slug page registrants can have their form pre-filled.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')?.trim().toLowerCase()

  if (!email) {
    return NextResponse.json({ found: false })
  }

  try {
    const admin = createAdminClient()

    const { data: profile } = await admin
      .from('profiles')
      .select('first_name, last_name, position, grad_year, jersey_number, high_school, city, state, gpa, height, weight, hudl_url')
      .eq('recovery_email', email)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json({ found: false })
    }

    return NextResponse.json({ found: true, profile })
  } catch (error) {
    console.error('[lookup-profile]', error)
    return NextResponse.json({ found: false })
  }
}
