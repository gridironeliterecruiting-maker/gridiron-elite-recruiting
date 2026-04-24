import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { zohoFetch } from '@/lib/workspace'

const ZOHO_API_BASE = 'https://mail360.zoho.com/api'

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('zoho_account_key')
    .eq('id', user.id)
    .single()

  const accountKey = profile?.zoho_account_key as string | null
  if (!accountKey) return NextResponse.json({ ok: true })

  try {
    // Mail360 "Mark emails as read" API
    // PUT /accounts/{account_key}/messages with mode: markAsRead, messageId: [ids]
    await zohoFetch(
      `${ZOHO_API_BASE}/accounts/${accountKey}/messages`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'markAsRead',
          messageId: [id],
        }),
      }
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[email/read] Error:', err)
    return NextResponse.json({ ok: true })
  }
}
