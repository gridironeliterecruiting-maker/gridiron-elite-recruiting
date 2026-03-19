import { NextResponse } from 'next/server'
import { checkZohoHealth } from '@/lib/workspace'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/cron/zoho-health
 * Daily cron — verifies Zoho Mail360 is healthy.
 * Logs result to system_settings so the admin dashboard can surface it.
 */
export async function GET(request: Request) {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await checkZohoHealth()
  const admin = createAdminClient()

  await admin.from('system_settings').upsert({
    key: 'zoho_health_last_check',
    value: JSON.stringify({
      ok: result.ok,
      error: result.error || null,
      checkedAt: new Date().toISOString(),
    }),
  }, { onConflict: 'key' })

  if (!result.ok) {
    console.error(`[CRON] Zoho health check FAILED: ${result.error}`)
  } else {
    console.log('[CRON] Zoho health check OK')
  }

  return NextResponse.json(result)
}
