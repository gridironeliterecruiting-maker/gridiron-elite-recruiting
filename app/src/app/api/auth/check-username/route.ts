import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const name = searchParams.get('name')?.toLowerCase().replace(/[^a-z0-9]/g, '')

  if (!name || name.length < 2) {
    return NextResponse.json({ available: false, suggested: '' })
  }

  try {
    const admin = createAdminClient()
    const { data: existing } = await admin
      .from('profiles')
      .select('id')
      .eq('username', name)
      .single()

    return NextResponse.json({ available: !existing, suggested: name })
  } catch (error) {
    console.error('[check-username]', error)
    return NextResponse.json({ available: true, suggested: name })
  }
}
