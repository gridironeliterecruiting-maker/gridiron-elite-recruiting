import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

type TemplateAudience = 'player' | 'coach'

/**
 * Determine if this user is a coach by checking program_members and coach_profiles.
 * Does NOT use profiles.role — that column only controls /admin access.
 */
async function detectCoach(userId: string): Promise<boolean> {
  const admin = createAdminClient()
  const [{ data: membership }, { data: legacyCoach }] = await Promise.all([
    admin
      .from('program_members')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'coach')
      .maybeSingle(),
    admin
      .from('coach_profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle(),
  ])
  return !!(membership || legacyCoach)
}

// GET /api/templates — return role-appropriate system templates + user's own
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isCoach = await detectCoach(user.id)
    const audience: TemplateAudience = isCoach ? 'coach' : 'player'

    const { data: templates, error } = await supabase
      .from('email_templates')
      .select('*')
      .or(`and(is_system.eq.true,for_role.eq.${audience}),created_by.eq.${user.id}`)
      .order('is_system', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching templates:', error)
      return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
    }

    return NextResponse.json({ templates, audience })
  } catch (error) {
    console.error('Unexpected error in GET /api/templates:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/templates — save a custom template tagged with the user's audience
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, subject, body: templateBody } = body
    if (!name || !subject || !templateBody) {
      return NextResponse.json({ error: 'Name, subject, and body are required' }, { status: 400 })
    }

    const isCoach = await detectCoach(user.id)
    const audience: TemplateAudience = isCoach ? 'coach' : 'player'

    const admin = createAdminClient()

    // Delete any existing user template with this name (upsert-by-name pattern)
    await admin
      .from('email_templates')
      .delete()
      .ilike('name', name)
      .eq('created_by', user.id)
      .eq('is_system', false)

    const { data: template, error } = await admin
      .from('email_templates')
      .insert({
        name,
        subject,
        body: templateBody,
        created_by: user.id,
        is_system: false,
        for_role: audience,
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving template:', error)
      return NextResponse.json({ error: 'Failed to save template' }, { status: 500 })
    }

    return NextResponse.json({ template }, { status: 201 })
  } catch (error) {
    console.error('Unexpected error in POST /api/templates:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
