import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { provisionZohoAccount } from '@/lib/workspace'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      inviteCode,
      slug,
      firstName,
      lastName,
      username,
      password,
      recoveryEmail,
      title,
      position,
      gradYear,
      jerseyNumber,
      highSchool,
      city,
      state,
      gpa,
      height,
      weight,
      hudlUrl,
    } = body

    if (!inviteCode || !slug || !firstName || !lastName || !username || !password || !recoveryEmail) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const admin = createAdminClient()
    const code = inviteCode.trim().toUpperCase()

    // Look up program and validate code
    const { data: program } = await admin
      .from('managed_programs')
      .select('id, school_name, coach_invite_code, player_invite_code, max_coaches, max_players')
      .eq('landing_slug', slug)
      .maybeSingle()

    if (!program) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 })
    }

    let role: 'coach' | 'player' | null = null
    if (code === program.coach_invite_code) role = 'coach'
    else if (code === program.player_invite_code) role = 'player'

    if (!role) {
      return NextResponse.json({ error: 'Invalid invite code' }, { status: 400 })
    }

    // Re-check spot availability (race condition guard)
    const { count } = await admin
      .from('program_members')
      .select('id', { count: 'exact', head: true })
      .eq('program_id', program.id)
      .eq('role', role)

    const used = count ?? 0
    const max = role === 'coach' ? program.max_coaches : program.max_players

    if (used >= max) {
      return NextResponse.json({ error: `This program has reached its ${role} limit.` }, { status: 409 })
    }

    // Check username not already taken
    const { data: existingUsername } = await admin
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle()

    if (existingUsername) {
      return NextResponse.json({ error: 'Username is already taken' }, { status: 409 })
    }

    const workspaceEmail = `${username}@${process.env.ZOHO_DOMAIN || 'jetstreammail.com'}`

    // Provision Zoho Mail360 account
    const zohoAccountKey = await provisionZohoAccount(username, firstName, lastName)

    // Create Supabase auth user
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: workspaceEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: `${firstName} ${lastName}`,
        first_name: firstName,
        last_name: lastName,
      },
    })

    if (authError || !authData.user) {
      console.error('[register-slug] Auth user creation failed:', authError)
      return NextResponse.json({ error: authError?.message || 'Failed to create account' }, { status: 500 })
    }

    const userId = authData.user.id

    // Upsert profile
    const { error: profileError } = await admin.from('profiles').upsert({
      id: userId,
      username,
      workspace_email: workspaceEmail,
      zoho_account_key: zohoAccountKey,
      recovery_email: recoveryEmail,
      email: workspaceEmail,
      first_name: firstName,
      last_name: lastName,
      title: title || null,
      position: position || null,
      grad_year: gradYear ? parseInt(gradYear) : null,
      jersey_number: jerseyNumber || null,
      high_school: highSchool || null,
      city: city || null,
      state: state || null,
      gpa: gpa ? parseFloat(gpa) : null,
      height: height || null,
      weight: weight ? parseInt(weight) : null,
      hudl_url: hudlUrl || null,
      role: role === 'coach' ? 'coach' : 'athlete',
      can_send_emails: true,
      is_grandfathered: false,
    })

    if (profileError) {
      console.error('[register-slug] Profile upsert failed:', profileError)
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    // Insert program_members entry
    const { error: memberError } = await admin.from('program_members').insert({
      program_id: program.id,
      user_id: userId,
      email: recoveryEmail,
      role,
    })

    if (memberError) {
      console.error('[register-slug] program_members insert failed:', memberError)
      return NextResponse.json({ error: memberError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, workspaceEmail, username, role })
  } catch (error: any) {
    console.error('[register-slug] Unexpected error:', error)
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}
