import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getWorkspaceGmailModifyToken } from '@/lib/workspace'

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('workspace_email')
    .eq('id', user.id)
    .single()

  const workspaceEmail = (profile as any)?.workspace_email as string | null
  if (!workspaceEmail) return NextResponse.json({ ok: true })

  try {
    const token = await getWorkspaceGmailModifyToken(workspaceEmail)
    await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/modify`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
      }
    )
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[email/read] Error:', err)
    return NextResponse.json({ ok: true })
  }
}
