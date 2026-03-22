import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { zohoFetch } from '@/lib/workspace'

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

  const accountKey = (profile as any)?.zoho_account_key as string | null
  if (!accountKey) return NextResponse.json({ ok: true })

  try {
    // Use Mail360 "Mark threads as read" API — marks entire conversation
    // PUT /accounts/{account_key}/threads with mode: markAsRead, threadId: [id]
    await zohoFetch(
      `https://mail360.zoho.com/api/accounts/${accountKey}/threads`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'markAsRead',
          threadId: [id],
        }),
      }
    )
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[email/read] Error:', err)
    return NextResponse.json({ ok: true })
  }
}
