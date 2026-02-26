import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// GET /api/templates - List all templates (system + user's own)
export async function GET() {
  try {
    const supabase = await createClient()
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch system templates and user's own templates
    const { data: templates, error } = await supabase
      .from('email_templates')
      .select('*')
      .or(`is_system.eq.true,created_by.eq.${user.id}`)
      .order('is_system', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching templates:', error)
      return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
    }

    return NextResponse.json({ templates })
  } catch (error) {
    console.error('Unexpected error in GET /api/templates:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/templates - Create a new template
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { name, subject, body: templateBody } = body

    // Validate required fields
    if (!name || !subject || !templateBody) {
      return NextResponse.json(
        { error: 'Name, subject, and body are required' },
        { status: 400 }
      )
    }

    // Delete any existing user template with this name, then insert fresh.
    // This avoids race conditions from check-then-insert patterns.
    const admin = createAdminClient()
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
        is_system: false
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving template:', error)
      return NextResponse.json({ error: 'Failed to save template' }, { status: 500 })
    }

    return NextResponse.json({ template }, { status: existing ? 200 : 201 })
  } catch (error) {
    console.error('Unexpected error in POST /api/templates:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}