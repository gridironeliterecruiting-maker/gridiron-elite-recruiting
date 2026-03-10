import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getZohoAccessToken } from '@/lib/workspace'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messageId } = await req.json()
  if (!messageId) return NextResponse.json({ error: 'messageId is required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('zoho_account_key')
    .eq('id', user.id)
    .single()

  const accountKey = (profile as any)?.zoho_account_key as string | null
  if (!accountKey) return NextResponse.json({ error: 'No Zoho account configured' }, { status: 400 })

  try {
    const token = await getZohoAccessToken()
    const res = await fetch(
      `https://mail360.zoho.com/api/accounts/${accountKey}/messages/${messageId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Zoho-oauthtoken ${token}` },
      }
    )
    if (!res.ok && res.status !== 404) {
      const err = await res.text()
      console.error('[email/delete] Zoho delete error:', err)
      return NextResponse.json({ error: 'Failed to delete email' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[email/delete] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
