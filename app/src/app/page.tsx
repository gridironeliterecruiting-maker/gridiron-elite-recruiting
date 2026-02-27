import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function Home() {
  const cookieStore = await cookies()
  const siteSession = cookieStore.get('site_session')?.value

  // Already logged into main site → go to dashboard
  if (siteSession === 'main') {
    redirect('/dashboard')
  }

  // Logged into a different site (or no session) → show main site login
  redirect('/login')
}
