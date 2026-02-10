import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NavBar from '@/components/NavBar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name, position, grad_year')
    .eq('id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-background">
      <NavBar profile={profile} />
      <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
        {children}
      </main>
      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 lg:px-8">
          <p className="text-xs text-muted-foreground">Gridiron Elite Recruiting</p>
          <p className="text-xs text-muted-foreground">Built for athletes, by athletes.</p>
        </div>
      </footer>
    </div>
  )
}
