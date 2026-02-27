import { createClient } from "@/lib/supabase/server"
import { LoginUI } from "@/components/login-ui"
import { UnauthorizedPage } from "@/components/unauthorized-page"
import { AdminDashboard } from "@/components/admin/admin-dashboard"
import { Suspense } from "react"

export const dynamic = "force-dynamic"

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Not logged in — show login page
  if (!user) {
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
