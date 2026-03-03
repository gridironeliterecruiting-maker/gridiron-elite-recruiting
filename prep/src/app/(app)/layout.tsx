import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/app-shell'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, role')
    .eq('id', user.id)
    .single()

  if (!profile?.first_name) redirect('/profile-setup')

  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, first_name, last_name, sport, grad_year')
    .eq('parent_id', user.id)
    .order('created_at')

  return (
    <AppShell
      profile={profile}
      athletes={athletes ?? []}
    >
      {children}
    </AppShell>
  )
}
