import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { provisionZohoAccount, generateUsernameOptions } from '@/lib/workspace'

export async function POST() {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch profile
  const { data: profile } = await admin
    .from('profiles')
    .select('first_name, last_name, jersey_number, workspace_email, zoho_account_key')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // Already provisioned — idempotent
  if (profile.workspace_email && profile.zoho_account_key) {
    return NextResponse.json({ email: profile.workspace_email })
  }

  const firstName = profile.first_name || 'athlete'
  const lastName = profile.last_name || user.id.slice(0, 6)
  const jerseyNumber = profile.jersey_number || undefined

  const candidates = generateUsernameOptions(firstName, lastName, jerseyNumber)

  // Find first available username
  let username: string | null = null
  for (const candidate of candidates) {
    const email = `${candidate}@${process.env.ZOHO_DOMAIN || 'jetstreammail.com'}`
    const { count } = await admin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_email', email)
    if (!count) {
      username = candidate
      break
    }
  }

  if (!username) {
    // Last resort: append grad year if available
    const { data: fullProfile } = await admin
      .from('profiles')
      .select('grad_year')
      .eq('id', user.id)
      .single()
    const base = candidates[0]
    username = fullProfile?.grad_year ? `${base}${fullProfile.grad_year}` : `${base}${Date.now().toString().slice(-4)}`
  }

  const workspaceEmail = `${username}@${process.env.ZOHO_DOMAIN || 'jetstreammail.com'}`

  try {
    const accountKey = await provisionZohoAccount(username, firstName, lastName)

    await admin
      .from('profiles')
      .update({ workspace_email: workspaceEmail, zoho_account_key: accountKey })
      .eq('id', user.id)

    return NextResponse.json({ email: workspaceEmail })
  } catch (err) {
    console.error('[workspace/create] Zoho provisioning failed:', err)
    return NextResponse.json({ error: 'Failed to create recruiting email. Please try again.' }, { status: 500 })
  }
}
