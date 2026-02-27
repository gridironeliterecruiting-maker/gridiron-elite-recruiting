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

  // Try managed_programs first (new system)
  const { data: program } = await admin
    .from("managed_programs")
    .select("id, school_name, mascot, logo_url, primary_color")
    .eq("landing_slug", slug)
    .maybeSingle()

  // Fall back to coach_profiles (legacy)
  let legacyCoach: { id: string; program_name: string; logo_url: string | null; primary_color: string | null } | null = null
  if (!program) {
    const { data: coach } = await admin
      .from("coach_profiles")
      .select("id, program_name, logo_url, primary_color")
      .eq("landing_slug", slug)
      .maybeSingle()
    legacyCoach = coach
  }

  if (!program && !legacyCoach) {
    notFound()
  }

  // Resolve branding
  const branding = program
    ? {
        name: [program.school_name, program.mascot].filter(Boolean).join(" "),
        logo: program.logo_url || "/logo.png",
        color: program.primary_color || undefined,
      }
    : {
        name: legacyCoach!.program_name,
        logo: legacyCoach!.logo_url || "/logo.png",
        color: legacyCoach!.primary_color || undefined,
      }

  // Check if user is authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Not logged in — show branded login page
  if (!user) {
    return (
      <Suspense>
        <LoginUI
          logoSrc={branding.logo}
          logoAlt={branding.name}
          programName={branding.name}
          primaryColor={branding.color}
          slug={slug}
        />
      </Suspense>
    )
  }

  // ── Managed programs authorization ──
  if (program) {
    // Check if user's email is in program_members
    const userEmail = user.email?.toLowerCase()

    const { data: member } = await admin
      .from("program_members")
      .select("id, role, user_id")
      .eq("program_id", program.id)
      .ilike("email", userEmail || "")
      .maybeSingle()

    if (member) {
      // Authorized — link user_id if not yet linked
      if (!member.user_id) {
        await admin
          .from("program_members")
          .update({ user_id: user.id })
          .eq("id", member.id)
      }

      // Set profile role based on membership — but never downgrade an admin
      const { data: currentProfile } = await admin
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()

      if (currentProfile?.role !== "admin") {
        const profileRole = member.role === "coach" ? "coach" : "athlete"
        await admin
          .from("profiles")
          .update({ role: profileRole })
          .eq("id", user.id)
      }

      // For coaches: ensure coach_profiles entry exists
      if (member.role === "coach") {
        const { data: existingCP } = await admin
          .from("coach_profiles")
          .select("id")
          .eq("id", user.id)
          .maybeSingle()

        if (!existingCP) {
          await admin
            .from("coach_profiles")
            .insert({
              id: user.id,
              program_name: branding.name,
              logo_url: program.logo_url,
              primary_color: program.primary_color,
              landing_slug: null, // managed_programs owns the slug
            })
        }
      }

      redirect(`/${slug}/dashboard`)
    }

    // Also check by user_id (for return visits after initial link)
    const { data: memberByUserId } = await admin
      .from("program_members")
      .select("id")
      .eq("program_id", program.id)
      .eq("user_id", user.id)
      .maybeSingle()

    if (memberByUserId) {
      redirect(`/${slug}/dashboard`)
    }

    // Check for existing access request
    const { data: existingRequest } = await admin
      .from("access_requests")
      .select("id, status")
      .eq("user_id", user.id)
      .eq("program_id", program.id)
      .maybeSingle()

    return (
      <Suspense>
        <UnauthorizedPage
          logoSrc={branding.logo}
          logoAlt={branding.name}
          programName={branding.name}
          primaryColor={branding.color}
          programId={program.id}
          existingRequestStatus={existingRequest?.status || null}
        />
      </Suspense>
    )
  }

  // ── Legacy coach_profiles authorization ──
  const isCoach = user.id === legacyCoach!.id

  let isPlayer = false
  if (!isCoach) {
    const { data: association } = await admin
      .from("coach_players")
      .select("id")
      .eq("coach_id", legacyCoach!.id)
      .eq("player_id", user.id)
      .maybeSingle()
    isPlayer = !!association
  }

  if (isCoach || isPlayer) {
    redirect(`/${slug}/dashboard`)
  }

  // Check for existing access request (legacy)
  const { data: existingRequest } = await admin
    .from("access_requests")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("coach_profile_id", legacyCoach!.id)
    .maybeSingle()

  return (
    <Suspense>
      <UnauthorizedPage
        logoSrc={branding.logo}
        logoAlt={branding.name}
        programName={branding.name}
        primaryColor={branding.color}
        coachProfileId={legacyCoach!.id}
        existingRequestStatus={existingRequest?.status || null}
      />
    </Suspense>
  )
}
