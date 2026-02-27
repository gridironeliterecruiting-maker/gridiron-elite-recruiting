import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function Home() {
  const cookieStore = await cookies()
  const siteSession = cookieStore.get('site_session')?.value
  if (siteSession && siteSession !== 'main') {
    if (siteSession === 'admin') {
      redirect('/admin')
    } else {
      redirect(`/${siteSession}/dashboard`)
    }
  }
  redirect('/dashboard')
}
