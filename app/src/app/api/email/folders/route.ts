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
    .order('filed_at', { ascending: false })

  if (!filed || filed.length === 0) {
    return NextResponse.json({ divisions: [] })
  }

  const divisionOrder = ['FBS', 'FCS', 'DII', 'DIII', 'NAIA', 'JUCO', 'Other']

  type EmailEntry = {
    id: string; thread_id: string | null; from_name: string | null
    from_email: string | null; coach_name: string | null; program_name: string | null
    subject: string; snippet: string; received_at: string | null; filed_at: string
  }
  type CoachBucket = { coach_id: string | null; coach_name: string; emails: EmailEntry[] }
  type SchoolBucket = { program_id: string | null; school_name: string; coaches: Record<string, CoachBucket> }
  type ConfBucket = Record<string, SchoolBucket>
  type DivBucket = Record<string, ConfBucket>

  const divMap: Record<string, DivBucket> = {}

  for (const e of filed) {
    const div = e.division || 'Other'
    const conf = e.conference || 'Other'
    const school = e.program_name || e.from_email || 'Unknown'
    const schoolKey = e.program_id || school
    const coachKey = e.coach_id || e.coach_name || e.from_email || 'unknown'
    const coachName = e.coach_name || e.from_name || e.from_email || 'Unknown'

    if (!divMap[div]) divMap[div] = {}
    if (!divMap[div][conf]) divMap[div][conf] = {}
    if (!divMap[div][conf][schoolKey]) {
      divMap[div][conf][schoolKey] = { program_id: e.program_id || null, school_name: school, coaches: {} }
    }
    if (!divMap[div][conf][schoolKey].coaches[coachKey]) {
      divMap[div][conf][schoolKey].coaches[coachKey] = { coach_id: e.coach_id || null, coach_name: coachName, emails: [] }
    }

    divMap[div][conf][schoolKey].coaches[coachKey].emails.push({
      id: e.gmail_message_id,
      thread_id: e.thread_id,
      from_name: e.from_name,
      from_email: e.from_email,
      coach_name: e.coach_name || e.from_name,
      program_name: e.program_name,
      subject: e.subject || '(No subject)',
      snippet: e.snippet || '',
      received_at: e.received_at,
      filed_at: e.filed_at,
    })
  }

  const divisions = Object.keys(divMap)
    .sort((a, b) => {
      const ai = divisionOrder.indexOf(a)
      const bi = divisionOrder.indexOf(b)
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    })
    .map((division) => ({
      division,
      conferences: Object.entries(divMap[division])
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([conference, schools]) => ({
          conference,
          schools: Object.values(schools)
            .sort((a, b) => a.school_name.localeCompare(b.school_name))
            .map((school) => ({
              program_id: school.program_id,
              school_name: school.school_name,
              coaches: Object.values(school.coaches)
                .sort((a, b) => a.coach_name.localeCompare(b.coach_name))
                .map((c) => ({ coach_id: c.coach_id, coach_name: c.coach_name, emails: c.emails })),
            })),
        })),
    }))

  return NextResponse.json({ divisions })
}
