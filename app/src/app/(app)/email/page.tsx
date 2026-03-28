import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeProposedEmail, provisionZohoAccount } from '@/lib/workspace'
import { redirect } from 'next/navigation'
import { EmailClient } from './email-client'

export default async function EmailPage() {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await admin
    .from('profiles')
    .select('workspace_email, zoho_account_key, first_name, last_name, jersey_number, grad_year')
    .eq('id', user.id)
    .single()

  let recruitingEmail: string | null = (profile as any)?.workspace_email || null

  // If no workspace email yet, auto-provision the Zoho mailbox now.
  // Never display a proposed/fake address — only show a real provisioned one.
  if (!recruitingEmail && profile?.first_name && profile?.last_name) {
    try {
      const proposedEmail = await computeProposedEmail(
        profile.first_name,
        profile.last_name,
        (profile as any).jersey_number,
        (profile as any).grad_year,
      )
      const username = proposedEmail.split('@')[0]
      const accountKey = await provisionZohoAccount(username, profile.first_name, profile.last_name)

      await admin
        .from('profiles')
        .update({ workspace_email: proposedEmail, zoho_account_key: accountKey })
        .eq('id', user.id)

      recruitingEmail = proposedEmail
    } catch (err) {
      console.error('[email/page] Failed to auto-provision Zoho account:', err)
      // Provisioning failed — show no email rather than a fake one
      recruitingEmail = null
    }
  }

  return <EmailClient recruitingEmail={recruitingEmail} />
}
