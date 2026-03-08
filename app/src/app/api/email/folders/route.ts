import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export interface FolderEmail {
  id: string
  campaign_id: string
  coach_id: string | null
  coach_name: string
  coach_email: string | null
  program_name: string
  replied_at: string | null
  filed_at: string
  subject: string
  snippet: string
}

export interface CoachFolder {
  coach_id: string | null
  coach_name: string
  emails: FolderEmail[]
}

export interface SchoolFolder {
  program_id: string
  school_name: string
  division: string
  conference: string
  coaches: CoachFolder[]
}

export interface ConferenceFolder {
  conference: string
  schools: SchoolFolder[]
}

export interface DivisionFolder {
  division: string
  conferences: ConferenceFolder[]
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Get user's campaigns
  const { data: campaigns } = await admin
    .from('campaigns')
    .select('id')
    .eq('user_id', user.id)

  if (!campaigns || campaigns.length === 0) {
    return NextResponse.json({ divisions: [] })
  }

  const campaignIds = campaigns.map((c: { id: string }) => c.id)

  // Get all filed emails
  const { data: filed, error } = await admin
    .from('campaign_recipients')
    .select(`
      id,
      campaign_id,
      coach_id,
      coach_name,
      coach_email,
      program_name,
      replied_at,
      filed_at,
      filed_program_id,
      filed_coach_id
    `)
    .in('campaign_id', campaignIds)
    .not('filed_at', 'is', null)
    .order('filed_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  if (!filed || filed.length === 0) {
    return NextResponse.json({ divisions: [] })
  }

  // Collect program IDs
  const programIds = [...new Set(filed.map((f: any) => f.filed_program_id).filter(Boolean))]

  // Fetch program details
  let programMap: Record<string, { id: string; school_name: string; division: string; conference: string }> = {}
  if (programIds.length > 0) {
    const { data: programs } = await admin
      .from('programs')
      .select('id, school_name, division, conference')
      .in('id', programIds)

    if (programs) {
      for (const p of programs) {
        programMap[p.id] = p
      }
    }
  }

  // Fetch email events for subjects/snippets
  const recipientIds = filed.map((f: any) => f.id)
  let eventsByRecipient: Record<string, { subject?: string; snippet?: string }> = {}

  if (recipientIds.length > 0) {
    const { data: events } = await admin
      .from('email_events')
      .select('recipient_id, event_type, metadata, created_at')
      .in('recipient_id', recipientIds)
      .eq('event_type', 'replied')
      .order('created_at', { ascending: false })

    if (events) {
      for (const ev of events) {
        if (!eventsByRecipient[ev.recipient_id]) {
          eventsByRecipient[ev.recipient_id] = {
            subject: ev.metadata?.subject,
            snippet: ev.metadata?.snippet,
          }
        }
      }
    }
  }

  // Build folder tree: Division > Conference > School > Coach
  // Group by division → conference → program → coach
  const divisionMap: Record<string, Record<string, Record<string, {
    programInfo: typeof programMap[string];
    coaches: Record<string, FolderEmail[]>
  }>>> = {}

  for (const f of filed) {
    const prog = f.filed_program_id ? programMap[f.filed_program_id] : null
    const division = prog?.division || 'Unknown'
    const conference = prog?.conference || 'Unknown'
    const programId = f.filed_program_id || 'unknown'
    const coachKey = f.filed_coach_id || f.coach_id || 'unknown'

    if (!divisionMap[division]) divisionMap[division] = {}
    if (!divisionMap[division][conference]) divisionMap[division][conference] = {}
    if (!divisionMap[division][conference][programId]) {
      divisionMap[division][conference][programId] = {
        programInfo: prog || { id: programId, school_name: f.program_name || 'Unknown', division, conference },
        coaches: {},
      }
    }
    if (!divisionMap[division][conference][programId].coaches[coachKey]) {
      divisionMap[division][conference][programId].coaches[coachKey] = []
    }

    const emailItem: FolderEmail = {
      id: f.id,
      campaign_id: f.campaign_id,
      coach_id: f.coach_id,
      coach_name: f.coach_name,
      coach_email: f.coach_email,
      program_name: f.program_name || prog?.school_name || 'Unknown',
      replied_at: f.replied_at,
      filed_at: f.filed_at,
      subject: eventsByRecipient[f.id]?.subject || '(No subject)',
      snippet: eventsByRecipient[f.id]?.snippet || '',
    }

    divisionMap[division][conference][programId].coaches[coachKey].push(emailItem)
  }

  // Serialize to array structure
  const divisionOrder = ['FBS', 'FCS', 'DII', 'DIII', 'NAIA', 'JUCO', 'Unknown']
  const divisions: DivisionFolder[] = Object.keys(divisionMap)
    .sort((a, b) => {
      const ai = divisionOrder.indexOf(a)
      const bi = divisionOrder.indexOf(b)
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    })
    .map((division) => {
      const conferences: ConferenceFolder[] = Object.keys(divisionMap[division])
        .sort()
        .map((conference) => {
          const schools: SchoolFolder[] = Object.values(divisionMap[division][conference])
            .sort((a, b) => a.programInfo.school_name.localeCompare(b.programInfo.school_name))
            .map(({ programInfo, coaches }) => {
              const coachFolders: CoachFolder[] = Object.entries(coaches)
                .map(([coachKey, emails]) => {
                  const first = emails[0]
                  return {
                    coach_id: first.coach_id,
                    coach_name: first.coach_name,
                    emails,
                  }
                })
                .sort((a, b) => a.coach_name.localeCompare(b.coach_name))

              return {
                program_id: programInfo.id,
                school_name: programInfo.school_name,
                division: programInfo.division,
                conference: programInfo.conference,
                coaches: coachFolders,
              }
            })

          return { conference, schools }
        })

      return { division, conferences }
    })

  return NextResponse.json({ divisions })
}
