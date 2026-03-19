import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data, error } = await admin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
    })

    if (error) {
      console.error('[register] User creation failed:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, userId: data.user.id })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('[register] Unexpected error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
