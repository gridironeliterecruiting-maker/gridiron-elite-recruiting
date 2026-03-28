import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: filed } = await admin
    .from('filed_emails')
    .select('*')
    .eq('user_id', user.id)
    .order('received_at', { ascending: false })

  if (!filed || filed.length === 0) {
    return NextResponse.json({ programs: [] })
  }

  // Collect unique program names and build program buckets
  const programMap = new Map<string, {
    programName: string
    programId: string | null
    threads: {
      id: string
      threadId: string | null
      subject: string
      snippet: string
      otherName: string
      otherEmail: string
      receivedAt: string | null
      filedAt: string
      messageCount: number
    }[]
  }>()

  for (const e of filed) {
    const programKey = e.program_name || e.from_email || 'Unknown'

    if (!programMap.has(programKey)) {
      programMap.set(programKey, {
        programName: programKey,
        programId: e.program_id || null,
        threads: [],
      })
    }

    programMap.get(programKey)!.threads.push({
      id: e.gmail_message_id,
      threadId: e.thread_id,
      subject: e.subject || '(No subject)',
      snippet: e.snippet || '',
      otherName: e.coach_name || e.from_name || e.from_email || 'Unknown',
      otherEmail: e.from_email || '',
      receivedAt: e.received_at,
      filedAt: e.filed_at,
      messageCount: 1,
    })
  }

  // Look up logos for programs that have a program_id
  const programIds = [...programMap.values()]
    .map(p => p.programId)
    .filter((id): id is string => !!id)

  const logoMap = new Map<string, string>()
  if (programIds.length > 0) {
    const { data: programs } = await admin
      .from('programs')
      .select('id, logo_url')
      .in('id', programIds)

    if (programs) {
      for (const p of programs) {
        if (p.logo_url) logoMap.set(p.id, p.logo_url)
      }
    }
  }

  // Build sorted program list
  const programs = [...programMap.values()]
    .sort((a, b) => a.programName.localeCompare(b.programName))
    .map(p => ({
      programName: p.programName,
      programId: p.programId,
      logoUrl: p.programId ? logoMap.get(p.programId) || null : null,
      threadCount: p.threads.length,
      threads: p.threads,
    }))

  return NextResponse.json({ programs })
}
