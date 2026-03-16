import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export default async function RootPage() {
  const cookieStore = await cookies()
  const siteSession = cookieStore.get('site_session')?.value
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user && siteSession === 'main') redirect('/hub')
  redirect('/login')
}
