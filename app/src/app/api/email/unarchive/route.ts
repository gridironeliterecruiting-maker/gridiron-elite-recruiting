import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { threadId, fromEmail } = await req.json()
  if (!threadId && !fromEmail) {
    return NextResponse.json({ error: 'threadId or fromEmail is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  if (threadId) {
    // Primary: delete by Zoho thread ID — precise, correct
    await admin
      .from('filed_emails')
      .delete()
      .eq('user_id', user.id)
      .eq('thread_id', threadId)
  }

  if (fromEmail) {
    // Fallback: also delete any legacy records keyed by email only
    await admin
      .from('filed_emails')
      .delete()
      .eq('user_id', user.id)
      .eq('from_email', fromEmail)
      .is('thread_id', null)
  }

  return NextResponse.json({ ok: true })
}
