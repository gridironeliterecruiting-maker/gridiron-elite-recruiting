import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { provisionZohoAccount } from '@/lib/workspace'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return null
  return user
}

// POST /api/admin/provision-user
// Body: { userId, username }
// Creates a Zoho mailbox and updates the user's profile.
export async function POST(request: Request) {
  const adminUser = await requireAdmin()
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId, username } = await request.json()
  if (!userId || !username) {
    return NextResponse.json({ error: 'userId and username required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('first_name, last_name, workspace_email, zoho_account_key')
    .eq('id', userId)
    .single()

  if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (profile.zoho_account_key) {
    return NextResponse.json({ error: 'User already has a Zoho account', workspace_email: profile.workspace_email })
  }

  try {
    const accountKey = await provisionZohoAccount(username, profile.first_name, profile.last_name)
    const workspaceEmail = `${username}@jetstreammail.com`

    await admin
      .from('profiles')
      .update({ workspace_email: workspaceEmail, zoho_account_key: accountKey })
      .eq('id', userId)

    return NextResponse.json({ success: true, workspace_email: workspaceEmail, account_key: accountKey })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Provisioning failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
