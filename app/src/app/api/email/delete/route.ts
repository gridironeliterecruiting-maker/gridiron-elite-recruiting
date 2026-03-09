import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getWorkspaceGmailModifyToken } from '@/lib/workspace'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { gmailMessageId } = await req.json()
  if (!gmailMessageId) return NextResponse.json({ error: 'gmailMessageId is required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('workspace_email')
    .eq('id', user.id)
    .single()

  const workspaceEmail = (profile as any)?.workspace_email as string | null
  if (!workspaceEmail) return NextResponse.json({ error: 'No workspace email' }, { status: 400 })

  try {
    const token = await getWorkspaceGmailModifyToken(workspaceEmail)
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmailMessageId}/trash`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }
    )
    if (!res.ok) {
      const err = await res.text()
      console.error('[email/delete] Gmail trash error:', err)
      return NextResponse.json({ error: 'Failed to delete email' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[email/delete] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
