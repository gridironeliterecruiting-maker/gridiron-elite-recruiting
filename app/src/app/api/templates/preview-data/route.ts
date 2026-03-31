import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatGPA } from '@/lib/utils'
import { getActivePlayerId } from '@/lib/active-player'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Determine if user is a coach
  const { data: membership } = await admin
    .from('program_members')
    .select('program_id, role')
    .eq('user_id', user.id)
    .eq('role', 'coach')
    .limit(1)
    .maybeSingle()

  const isCoach = !!membership

  // Fetch sender profile
  const { data: senderProfile } = await supabase
    .from('profiles')
    .select('first_name, last_name, position, grad_year, high_school, city, state, gpa, hudl_url, primary_video_url, phone, email, title')
    .eq('id', user.id)
    .single()

  let mergeData: Record<string, string> = {}

  if (isCoach && membership) {
    // Get managed program data (authoritative school/city/state)
    const { data: program } = await admin
      .from('managed_programs')
      .select('school_name, city, state')
      .eq('id', membership.program_id)
      .single()

    // Get active player's profile
    const activePlayerId = await getActivePlayerId()
    let playerProfile: any = null
    if (activePlayerId) {
      const { data: pp } = await supabase
        .from('profiles')
        .select('first_name, last_name, position, grad_year, high_school, city, state, gpa, hudl_url, primary_video_url, phone, email')
        .eq('id', activePlayerId)
        .single()
      playerProfile = pp
    }

    mergeData = {
      'Coach Last Name': '',
      'Coach First Name': '',
      'Coach Name': '',
      'School Name': '',
      'Player First Name': playerProfile?.first_name || 'Player',
      'Player Last Name': playerProfile?.last_name || 'Name',
      'Player Position': playerProfile?.position || 'Position',
      'Player Grad Year': playerProfile?.grad_year?.toString() || '2026',
      'Player High School': program?.school_name || playerProfile?.high_school || '',
      'Player City': program?.city || playerProfile?.city || '',
      'Player State': program?.state || playerProfile?.state || '',
      'Player GPA': formatGPA(playerProfile?.gpa) || '',
      'Player Film Link': playerProfile?.primary_video_url || playerProfile?.hudl_url || '',
      'Player Phone': playerProfile?.phone || '',
      'Player Email': playerProfile?.email || '',
      'My First Name': senderProfile?.first_name || '',
      'My Last Name': senderProfile?.last_name || '',
      'My Title': (senderProfile as any)?.title || 'Head Coach',
    }
  } else {
    // Athlete — sender IS the player
    mergeData = {
      'Coach Last Name': '',
      'Coach First Name': '',
      'Coach Name': '',
      'School Name': '',
      'Player First Name': senderProfile?.first_name || '',
      'Player Last Name': senderProfile?.last_name || '',
      'Player Position': senderProfile?.position || '',
      'Player Grad Year': senderProfile?.grad_year?.toString() || '',
      'Player High School': senderProfile?.high_school || '',
      'Player City': senderProfile?.city || '',
      'Player State': senderProfile?.state || '',
      'Player GPA': formatGPA(senderProfile?.gpa) || '',
      'Player Film Link': (senderProfile as any)?.primary_video_url || senderProfile?.hudl_url || '',
      'Player Phone': senderProfile?.phone || '',
      'Player Email': senderProfile?.email || '',
      'Coach Phone': '',
      'Coach Email Address': '',
    }
  }

  return NextResponse.json({ mergeData, isCoach })
}
