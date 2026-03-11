import { notFound, redirect } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { SlugLanding } from "@/components/slug-landing"
import { Suspense } from "react"

export const dynamic = "force-dynamic"

// Per-program background images. Add new slugs here as programs onboard.
const slugBackgrounds: Record<string, string> = {
  'prairie-ia': '/prairie-ia-bg.png',
}

interface LandingPageProps {
  params: Promise<{ slug: string }>
}

export default async function LandingPage({ params }: LandingPageProps) {
  const { slug } = await params
  const admin = createAdminClient()

  const { data: program } = await admin
    .from("managed_programs")
    .select("id, school_name, mascot, city, state, logo_url, primary_color, accent_color")
    .eq("landing_slug", slug)
    .maybeSingle()

  if (!program) {
    notFound()
  }

  const branding = {
    name: [program.school_name, program.mascot].filter(Boolean).join(" "),
    logo: program.logo_url || "/logo.png",
    color: program.primary_color || "#0047AB",
    accent: program.accent_color || "#CC0000",
    bg: slugBackgrounds[slug] ?? "/locker-room-bg.png",
    schoolName: program.school_name,
    city: program.city || "",
    state: program.state || "",
  }

  // If user is already authenticated and logged into THIS site, send them to hub
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const cookieStore = await cookies()
  const siteSession = cookieStore.get("site_session")?.value

  if (user && siteSession === slug) {
    // Verify they're actually a member of this program
    const { data: member } = await admin
      .from("program_members")
      .select("id")
      .eq("program_id", program.id)
      .eq("user_id", user.id)
      .maybeSingle()

    if (member) {
      redirect(`/${slug}/hub`)
    }
    // Authenticated but not a member — fall through to show landing page
    // (they may have a session from a different program)
  }

  return (
    <Suspense>
      <SlugLanding
        logoSrc={branding.logo}
        logoAlt={branding.name}
        programName={branding.name}
        primaryColor={branding.color}
        accentColor={branding.accent}
        slug={slug}
        backgroundImage={branding.bg}
        schoolName={branding.schoolName}
        programCity={branding.city}
        programState={branding.state}
      />
    </Suspense>
  )
}
