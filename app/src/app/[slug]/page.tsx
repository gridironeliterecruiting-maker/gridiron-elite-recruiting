import { notFound, redirect } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { LoginUI } from "@/components/login-ui"
import { UnauthorizedPage } from "@/components/unauthorized-page"
import { Suspense } from "react"

export const dynamic = "force-dynamic"

interface LandingPageProps {
  params: Promise<{ slug: string }>
}

export default async function LandingPage({ params }: LandingPageProps) {
  const { slug } = await params
  const admin = createAdminClient()

  // Look up the program by landing slug
  const { data: coach } = await admin
    .from("coach_profiles")
    .select("id, program_name, logo_url, primary_color")
    .eq("landing_slug", slug)
    .single()

  if (!coach) {
    notFound()
  }

  // Check if user is authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Not logged in — show branded login page
  if (!user) {
    return (
      <Suspense>
        <LoginUI
          logoSrc={coach.logo_url || "/logo.png"}
          logoAlt={coach.program_name}
          programName={coach.program_name}
          primaryColor={coach.primary_color || undefined}
          slug={slug}
        />
      </Suspense>
    )
  }

  // User is authenticated — check if they're authorized for this program
  const isCoach = user.id === coach.id

  let isPlayer = false
  if (!isCoach) {
    const { data: association } = await admin
      .from("coach_players")
      .select("id")
      .eq("coach_id", coach.id)
      .eq("player_id", user.id)
      .maybeSingle()

    isPlayer = !!association
  }

  // Authorized — send them to the dashboard
  if (isCoach || isPlayer) {
    redirect("/dashboard")
  }

  // Check if they already have a pending request
  const { data: existingRequest } = await admin
    .from("access_requests")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("coach_profile_id", coach.id)
    .maybeSingle()

  // Not authorized — show branded unauthorized page
  return (
    <Suspense>
      <UnauthorizedPage
        logoSrc={coach.logo_url || "/logo.png"}
        logoAlt={coach.program_name}
        programName={coach.program_name}
        primaryColor={coach.primary_color || undefined}
        coachProfileId={coach.id}
        existingRequestStatus={existingRequest?.status || null}
      />
    </Suspense>
  )
}
