import { notFound } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/admin"
import { LoginUI } from "@/components/login-ui"
import { Suspense } from "react"

export const dynamic = "force-dynamic"

interface LandingPageProps {
  params: Promise<{ slug: string }>
}

export default async function LandingPage({ params }: LandingPageProps) {
  const { slug } = await params
  const admin = createAdminClient()

  const { data: coach } = await admin
    .from("coach_profiles")
    .select("id, program_name, logo_url, primary_color")
    .eq("landing_slug", slug)
    .single()

  if (!coach) {
    notFound()
  }

  return (
    <Suspense>
      <LoginUI
        logoSrc={coach.logo_url || "/logo.png"}
        logoAlt={coach.program_name}
        programName={coach.program_name}
        primaryColor={coach.primary_color || undefined}
      />
    </Suspense>
  )
}
