import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// PUT /api/templates/[id] - Update a template
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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

    // Validate at least one field is being updated
    if (!name && !subject && !templateBody) {
      return NextResponse.json(
        { error: 'At least one field (name, subject, or body) must be provided' },
        { status: 400 }
      )
    }

    // Build update object
    const updates: any = { updated_at: new Date().toISOString() }
    if (name) updates.name = name
    if (subject) updates.subject = subject
    if (templateBody) updates.body = templateBody

    // Update the template (only if user owns it)
    const { data: template, error } = await supabase
      .from('email_templates')
      .update(updates)
      .eq('id', id)
      .eq('created_by', user.id)
      .eq('is_system', false) // Can't update system templates
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Template not found or you do not have permission to update it' },
          { status: 404 }
        )
      }
      console.error('Error updating template:', error)
      return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })
    }

    return NextResponse.json({ template })
  } catch (error) {
    console.error('Unexpected error in PUT /api/templates/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/templates/[id] - Delete a template
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const supabase = await createClient()
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Delete the template (only if user owns it, use admin to bypass RLS)
    const admin = createAdminClient()
    const { error } = await admin
      .from('email_templates')
      .delete()
      .eq('id', id)
      .eq('created_by', user.id)
      .eq('is_system', false) // Can't delete system templates

    if (error) {
      console.error('Error deleting template:', error)
      return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error in DELETE /api/templates/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}