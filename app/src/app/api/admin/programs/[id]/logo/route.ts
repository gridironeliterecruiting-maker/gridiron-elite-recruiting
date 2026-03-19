import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') return null
  return user
}

// POST /api/admin/programs/[id]/logo - Upload logo
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const supabase = await createClient()
    const user = await requireAdmin(supabase)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await request.formData()

    // Supports two fields: 'logo' (team logo) and 'background_image' (slug page background)
    const isBgImage = formData.has('background_image')
    const file = (formData.get('background_image') ?? formData.get('logo')) as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'File must be PNG, JPEG, or WebP' }, { status: 400 })
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File must be under 5MB' }, { status: 400 })
    }

    const admin = createAdminClient()
    const ext = file.name.split('.').pop() || 'jpg'
    const fileKey = isBgImage ? 'background' : 'logo'
    const filePath = `${id}/${fileKey}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await admin.storage
      .from('program-logos')
      .upload(filePath, arrayBuffer, { contentType: file.type, upsert: true })

    if (uploadError) {
      console.error('Error uploading logo:', uploadError)
      return NextResponse.json({ error: 'Failed to upload logo' }, { status: 500 })
    }

    const { data: { publicUrl } } = admin.storage
      .from('program-logos')
      .getPublicUrl(filePath)

    const dbField = isBgImage ? 'background_image_url' : 'logo_url'
    const { error: updateError } = await admin
      .from('managed_programs')
      .update({ [dbField]: publicUrl })
      .eq('id', id)

    if (updateError) {
      console.error('Error updating program logo URL:', updateError)
      return NextResponse.json({ error: 'Logo uploaded but failed to update program' }, { status: 500 })
    }

    return NextResponse.json({ [dbField]: publicUrl })
  } catch (error) {
    console.error('Error in POST /api/admin/programs/[id]/logo:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
