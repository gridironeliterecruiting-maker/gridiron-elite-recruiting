import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { EmailClient } from './email-client'

export default async function EmailPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return <EmailClient />
}
