import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { LoginUI } from "@/components/login-ui"
import { UnauthorizedPage } from "@/components/unauthorized-page"
import { AdminDashboard } from "@/components/admin/admin-dashboard"
import { Suspense } from "react"

export const dynamic = "force-dynamic"

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const cookieStore = await cookies()
  const siteSession = cookieStore.get('site_session')?.value

  // Not logged in, or logged into a different site — show admin login page
  if (!user || siteSession !== 'admin') {
    return (
      <Suspense>
        <LoginUI
          programName="Platform Administration"
          slug="admin"
        />
      </Suspense>
    )
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return (
      <Suspense>
        <UnauthorizedPage
          programName="Platform Administration"
          adminMode
        />
      </Suspense>
    )
  }

  // Admin — show dashboard
  return <AdminDashboard />
}
