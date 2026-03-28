import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { fromEmail } = await req.json()
  if (!fromEmail) {
    return NextResponse.json({ error: 'fromEmail is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Delete all filed_emails rows for this sender — moves thread back to inbox
  await admin
    .from('filed_emails')
    .delete()
    .eq('user_id', user.id)
    .eq('from_email', fromEmail)

  return NextResponse.json({ ok: true })
}
