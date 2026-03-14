import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { AdminLogin } from "@/components/admin/admin-login"
import { AdminDashboard } from "@/components/admin/admin-dashboard"
import { Suspense } from "react"

export const dynamic = "force-dynamic"

const ADMIN_EMAIL = 'pauladmin@jetstreammail.com'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const cookieStore = await cookies()
  const siteSession = cookieStore.get('site_session')?.value

  // Must be logged in, have admin session cookie, and be the authorized admin email
  if (!user || siteSession !== 'admin' || user.email !== ADMIN_EMAIL) {
    return (
      <Suspense>
        <AdminLogin />
      </Suspense>
    )
  }

  // Admin — show dashboard
  return <AdminDashboard />
}
