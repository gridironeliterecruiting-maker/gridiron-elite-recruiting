import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify ownership
  const { data: conn } = await supabase
    .from('connections').select('id').eq('id', id).eq('parent_id', user.id).single()
  if (!conn) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('connection_interactions')
    .select('*')
    .eq('connection_id', id)
    .order('occurred_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: conn } = await supabase
    .from('connections').select('id').eq('id', id).eq('parent_id', user.id).single()
  if (!conn) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()

  const { data, error } = await supabase
    .from('connection_interactions')
    .insert({
      connection_id: id,
      type: body.type,
      notes: body.notes ?? null,
      occurred_at: body.occurred_at ?? new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Update last_contact_at on the connection
  await supabase
    .from('connections')
    .update({ last_contact_at: body.occurred_at ?? new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json(data, { status: 201 })
}
