import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkZohoHealth } from '@/lib/workspace'

/**
 * GET /api/admin/zoho-health
 * Verifies Zoho Mail360 token is valid. Admin only.
 *
 * POST /api/admin/zoho-health
 * Body: { refreshToken: string }
 * Rotates the Zoho refresh token stored in Supabase — no redeploy needed.
 */

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const result = await checkZohoHealth()
  return NextResponse.json(result, { status: result.ok ? 200 : 503 })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { refreshToken } = await request.json()
  if (!refreshToken || typeof refreshToken !== 'string' || !refreshToken.trim()) {
    return NextResponse.json({ error: 'refreshToken is required' }, { status: 400 })
  }

  const admin = (await import('@/lib/supabase/admin')).createAdminClient()
  await admin
    .from('system_settings')
    .upsert({ key: 'zoho_refresh_token', value: refreshToken.trim() }, { onConflict: 'key' })

  // Verify the new token works
  const result = await checkZohoHealth()
  if (!result.ok) {
    return NextResponse.json({ error: `Token saved but health check failed: ${result.error}` }, { status: 400 })
  }

  return NextResponse.json({ ok: true, message: 'Refresh token updated and verified' })
}
