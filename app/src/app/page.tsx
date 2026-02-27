import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function Home() {
  const cookieStore = await cookies()
  const programSlug = cookieStore.get('program_slug')?.value
  if (programSlug) {
    redirect(`/${programSlug}/dashboard`)
  }
  redirect('/dashboard')
}
