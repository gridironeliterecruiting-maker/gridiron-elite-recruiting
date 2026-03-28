import Image from "next/image"
import { notFound } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/admin"
import { formatGPA } from "@/lib/utils"
import { RecruitDocuments } from "./recruit-documents"

export const dynamic = "force-dynamic"

interface RecruitPageProps {
  params: Promise<{ slug: string }>
}

export default async function RecruitPage({ params }: RecruitPageProps) {
  const { slug } = await params
  const admin = createAdminClient()

  // Look up athlete by share slug
  const { data: profile } = await admin
    .from("profiles")
    .select("id, first_name, last_name, position, grad_year, high_school, city, state, height, weight, gpa, hudl_url, twitter_handle, profile_image_url")
    .eq("share_slug", slug)
    .single()

  if (!profile) {
    notFound()
  }

  // Branding comes from the ATHLETE's program membership — not the viewer's cookie.
  // This ensures the recruiting drive always shows the correct program branding
  // regardless of who is viewing it or what site they're logged into.
  let programBranding: { logo_url: string | null; primary_color: string | null; accent_color: string | null; school_name: string | null; mascot: string | null } | null = null

  // Find the athlete's program via program_members
  const { data: membership } = await admin
    .from("program_members")
    .select("program_id")
    .eq("user_id", profile.id)
    .eq("role", "player")
    .maybeSingle()

  if (membership?.program_id) {
    const { data: prog } = await admin
      .from("managed_programs")
      .select("logo_url, primary_color, accent_color, school_name, mascot")
      .eq("id", membership.program_id)
      .maybeSingle()
    programBranding = prog
  }

  const logoSrc = programBranding?.logo_url || "/logo.png"
  const logoAlt = programBranding
    ? [programBranding.school_name, programBranding.mascot].filter(Boolean).join(" ")
    : "Runway Recruit"
  const primaryColor = programBranding?.primary_color || "hsl(224,76%,20%)"
  const accentColor = programBranding?.accent_color || "hsl(0,72%,51%)"

  // Get visible documents (all types including folders)
  const { data: documents } = await admin
    .from("athlete_documents")
    .select("*")
    .eq("athlete_id", profile.id)
    .eq("is_visible", true)
    .order("display_order", { ascending: true })

  const fullName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim()
  const locationParts = [profile.high_school, [profile.city, profile.state].filter(Boolean).join(", ")].filter(Boolean).join(" / ")

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""

  return (
    <div className="min-h-screen bg-gradient-to-b from-[hsl(220,20%,97%)] to-[hsl(220,20%,97%)]"
      style={{ background: `linear-gradient(to bottom, ${primaryColor}, hsl(220,20%,97%))` }}
    >
      {/* Top accent stripe */}
      <div className="h-1" style={{ backgroundColor: accentColor }} />

      {/* Header content box */}
      <header className="px-4 pb-0 pt-3">
        <div className="mx-auto flex max-w-3xl justify-center">
          <div className="flex items-center gap-6 sm:gap-8">
            {/* Logo — left */}
            <div className="relative h-[100px] w-[100px] shrink-0 drop-shadow-lg">
              <Image
                src={logoSrc}
                alt={logoAlt}
                fill
                className="object-contain"
                priority
              />
            </div>

            {/* Info — right, left-justified, locked to logo height */}
            <div className="flex h-[100px] min-w-0 flex-col justify-between">
              {/* Row 1: Name */}
              <h1 className="font-display text-3xl font-bold uppercase leading-tight tracking-tight text-white">
                {fullName}
              </h1>

              {/* Middle: Position · Class · School/City + GPA · Height · Weight */}
              <div className="space-y-0.5">
                <p className="text-[11px] leading-tight text-white/70">
                  {[
                    profile.position,
                    profile.grad_year ? `Class of ${profile.grad_year}` : null,
                    locationParts || null,
                  ].filter(Boolean).join(" \u00B7 ")}
                </p>
                {(profile.gpa || profile.height || profile.weight) && (
                  <p className="text-[10px] leading-tight text-white/50">
                    {[
                      profile.gpa ? `${formatGPA(profile.gpa)} GPA` : null,
                      profile.height,
                      profile.weight ? `${profile.weight} lbs` : null,
                    ].filter(Boolean).join(" \u00B7 ")}
                  </p>
                )}
              </div>

              {/* Links row — anchored to bottom */}
              <div className="flex flex-wrap items-center gap-1.5">
                {profile.twitter_handle && (
                  <a
                    href={`https://x.com/${profile.twitter_handle.replace("@", "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-[52px] rounded-md bg-white/10 px-3 py-1 text-center text-[11px] font-bold text-white transition-colors hover:bg-white/20"
                  >
                    X
                  </a>
                )}
                {profile.hudl_url && (
                  <a
                    href={profile.hudl_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-[52px] rounded-md px-3 py-1 text-center text-[11px] font-bold text-white transition-opacity hover:opacity-80"
                    style={{ backgroundColor: accentColor }}
                  >
                    Hudl
                  </a>
                )}
                {!profile.twitter_handle && !profile.hudl_url && (
                  <span className="h-[26px]" />
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Documents section — same max-width as header for alignment */}
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-2">
        <RecruitDocuments documents={documents || []} supabaseUrl={supabaseUrl} />

        {/* Footer branding */}
        <div className="mt-12 flex flex-col items-center gap-2 text-center">
          <div className="relative h-10 w-10 opacity-40">
            <Image
              src="/logo.png"
              alt="Runway Recruit"
              fill
              className="object-contain"
            />
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[hsl(222,47%,11%)]/30">
            Powered by Runway Recruit
          </p>
        </div>
      </main>
    </div>
  )
}
