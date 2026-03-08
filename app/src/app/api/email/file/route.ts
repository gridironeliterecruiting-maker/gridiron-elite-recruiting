import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getWorkspaceGmailModifyToken } from '@/lib/workspace'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    gmailMessageId,
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
    gmailMessageId: string
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

  if (!gmailMessageId) {
    return NextResponse.json({ error: 'gmailMessageId is required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('workspace_email')
    .eq('id', user.id)
    .single()

  const workspaceEmail = (profile as any)?.workspace_email as string | null

  // Archive in Gmail (remove from INBOX)
  if (workspaceEmail) {
    try {
      const token = await getWorkspaceGmailModifyToken(workspaceEmail)
      await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmailMessageId}/modify`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ removeLabelIds: ['INBOX', 'UNREAD'] }),
        }
      )
    } catch (err) {
      console.error('[email/file] Gmail archive error:', err)
    }
  }

  // Store in filed_emails table
  await admin.from('filed_emails').upsert({
    user_id: user.id,
    gmail_message_id: gmailMessageId,
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
