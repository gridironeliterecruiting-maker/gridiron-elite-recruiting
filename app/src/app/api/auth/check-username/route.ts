import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkUsernameAvailable, generateUsername } from '@/lib/workspace'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const name = searchParams.get('name')?.toLowerCase().replace(/[^a-z0-9]/g, '')

  if (!name || name.length < 2) {
    return NextResponse.json({ available: false, suggested: '' })
  }

  try {
    // Check DB first (faster than Workspace API for most cases)
    const admin = createAdminClient()
    const { data: existing } = await admin
      .from('profiles')
      .select('id')
      .eq('username', name)
      .single()

    if (existing) {
      return NextResponse.json({ available: false, suggested: name })
    }

    // Check Workspace
    const available = await checkUsernameAvailable(name)
    return NextResponse.json({ available, suggested: name })
  } catch (error) {
    console.error('[check-username]', error)
    // On Workspace API error, fall through to available=true so UX doesn't break
    return NextResponse.json({ available: true, suggested: name })
  }
}
