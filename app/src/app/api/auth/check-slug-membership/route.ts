import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('slug')

  if (!slug) {
    return NextResponse.json({ member: false, error: 'Slug required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ member: false })
  }

  const admin = createAdminClient()

  const { data: program } = await admin
    .from('managed_programs')
    .select('id')
    .eq('landing_slug', slug)
    .maybeSingle()

  if (!program) {
    return NextResponse.json({ member: false, error: 'Program not found' })
  }

  const { data: membership } = await admin
    .from('program_members')
    .select('id')
    .eq('program_id', program.id)
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({ member: !!membership })
}
