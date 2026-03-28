import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * Lightweight new-email check — queries OUR database, never hits Zoho.
 * Returns the latest notification timestamp and count of notifications
 * since a given `since` timestamp (ISO string query param).
 *
 * The client polls this every 30s. When it detects new notifications,
 * the client triggers a full inbox refresh (which hits Zoho once).
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const since = req.nextUrl.searchParams.get('since')
  const admin = createAdminClient()

  // Get the latest notification for this user
  const { data: latest } = await admin
    .from('email_notifications')
    .select('id, from_address, subject, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // If `since` provided, count how many new notifications since then
  let newCount = 0
  if (since) {
    const { count } = await admin
      .from('email_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gt('created_at', since)
    newCount = count || 0
  }

  return NextResponse.json({
    latestAt: latest?.created_at || null,
    latestFrom: latest?.from_address || null,
    latestSubject: latest?.subject || null,
    newCount,
  })
}
