import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    messageId,
    threadId,
    fromEmail,
    fromName,
    subject,
    snippet,
    receivedAt,
    coachId,
    programId,
    coachName,
    programName,
    division,
    conference,
  } = body as {
    messageId: string
    threadId?: string
    fromEmail?: string
    fromName?: string
    subject?: string
    snippet?: string
    receivedAt?: string
    coachId?: string
    programId?: string
    coachName?: string
    programName?: string
    division?: string
    conference?: string
  }

  if (!messageId) {
    return NextResponse.json({ error: 'messageId is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Store in filed_emails table — this removes it from the inbox view in our app
  await admin.from('filed_emails').upsert({
    user_id: user.id,
    gmail_message_id: messageId,
    thread_id: threadId || null,
    from_email: fromEmail || null,
    from_name: fromName || null,
    subject: subject || null,
    snippet: snippet || null,
    received_at: receivedAt || null,
    coach_id: coachId || null,
    program_id: programId || null,
    coach_name: coachName || null,
    program_name: programName || null,
    division: division || null,
    conference: conference || null,
    filed_at: new Date().toISOString(),
  }, { onConflict: 'user_id,gmail_message_id' })

  return NextResponse.json({ ok: true })
}
