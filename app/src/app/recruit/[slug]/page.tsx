import Image from "next/image"
import { notFound } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/admin"
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
    <div className="min-h-screen bg-gradient-to-b from-[hsl(224,76%,20%)] to-[hsl(220,20%,97%)]">
      {/* Top accent stripe */}
      <div className="h-1 bg-[hsl(0,72%,51%)]" />

      {/* Header content box */}
      <header className="px-4 pb-0 pt-3">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-6 sm:gap-8">
            {/* Logo — left */}
            <div className="relative h-[160px] w-[160px] shrink-0 drop-shadow-lg sm:h-[200px] sm:w-[200px]">
              <Image
                src="/logo.png"
                alt="Runway Elite Recruiting"
                fill
                className="object-contain"
                priority
              />
            </div>

            {/* Info — right, left-justified */}
            <div className="min-w-0 flex-1">
              {/* Row 1: Name */}
              <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-white sm:text-3xl lg:text-4xl">
                {fullName}
              </h1>

              {/* Row 2: Position, Class, School/City */}
              <p className="mt-1.5 text-sm text-white/70 sm:text-base">
                {[
                  profile.position,
                  profile.grad_year ? `Class of ${profile.grad_year}` : null,
                  locationParts || null,
                ].filter(Boolean).join(" \u00B7 ")}
              </p>

              {/* Row 3: GPA, Height, Weight */}
              {(profile.gpa || profile.height || profile.weight) && (
                <p className="mt-1 text-sm text-white/50">
                  {[
                    profile.gpa ? `${profile.gpa} GPA` : null,
                    profile.height,
                    profile.weight ? `${profile.weight} lbs` : null,
                  ].filter(Boolean).join(" \u00B7 ")}
                </p>
              )}

              {/* Links row */}
              {(profile.twitter_handle || profile.hudl_url) && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {profile.twitter_handle && (
                    <a
                      href={`https://x.com/${profile.twitter_handle.replace("@", "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg bg-white/10 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-white/20"
                    >
                      X
                    </a>
                  )}
                  {profile.hudl_url && (
                    <a
                      href={profile.hudl_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg bg-[hsl(0,72%,51%)] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[hsl(0,72%,45%)]"
                    >
                      Hudl
                    </a>
                  )}
                </div>
              )}
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
              alt="Runway Elite Recruiting"
              fill
              className="object-contain"
            />
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[hsl(222,47%,11%)]/30">
            Powered by Runway Elite Recruiting
          </p>
        </div>
      </main>
    </div>
  )
}
