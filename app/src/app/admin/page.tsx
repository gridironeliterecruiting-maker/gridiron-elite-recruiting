import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { cookies } from "next/headers"
import { AdminLogin } from "@/components/admin/admin-login"
import { AdminDashboard } from "@/components/admin/admin-dashboard"
import { Suspense } from "react"

export const dynamic = "force-dynamic"

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const cookieStore = await cookies()
  const siteSession = cookieStore.get('site_session')?.value

  if (!user || siteSession !== 'admin') {
    return (
      <Suspense>
        <AdminLogin />
      </Suspense>
    )
  }

  // Verify admin role via admin client (bypasses RLS)
  const adminClient = createAdminClient()
  const { data: profile } = await adminClient.from('profiles').select('role').eq('id', user.id).single()

  if (profile?.role !== 'admin') {
    return (
      <Suspense>
        <AdminLogin />
      </Suspense>
    )
  }

  // Fetch admin's twitter token
  const { data: twitterToken } = await adminClient
    .from('twitter_tokens')
    .select('twitter_handle')
    .eq('user_id', user.id)
    .maybeSingle()

  // Admin — show dashboard
  return <AdminDashboard twitterHandle={twitterToken?.twitter_handle ?? null} hasTwitterToken={!!twitterToken} />
}
