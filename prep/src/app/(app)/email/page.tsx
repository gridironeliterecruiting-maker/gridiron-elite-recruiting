import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeProposedEmail } from '@/lib/workspace'
import { redirect } from 'next/navigation'
import { EmailClient } from './email-client'

export default async function EmailPage() {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await admin
    .from('profiles')
    .select('workspace_email, first_name, last_name, jersey_number, grad_year')
    .eq('id', user.id)
    .single()

  const workspaceEmail = (profile as any)?.workspace_email || null
  let recruitingEmail: string | null = workspaceEmail
  if (!recruitingEmail && profile?.first_name && profile?.last_name) {
    recruitingEmail = await computeProposedEmail(
      profile.first_name,
      profile.last_name,
      (profile as any).jersey_number,
      (profile as any).grad_year,
    )
  }

  return <EmailClient recruitingEmail={recruitingEmail} />
}
