import Image from "next/image"
import { notFound } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/admin"

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

  // Get visible documents
  const { data: documents } = await admin
    .from("athlete_documents")
    .select("*")
    .eq("athlete_id", profile.id)
    .eq("is_visible", true)
    .order("display_order", { ascending: true })

  const fullName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim()
  const locationParts = [profile.high_school, [profile.city, profile.state].filter(Boolean).join(", ")].filter(Boolean).join(" / ")

  const links = (documents || []).filter((d) => d.type === "link" || d.type === "video")
  const files = (documents || []).filter((d) => d.type === "file")
  const hasDocuments = links.length > 0 || files.length > 0

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
                alt="Gridiron Elite Recruiting"
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
        {hasDocuments ? (
          <div className="flex flex-col gap-6">
            {/* Links & Videos */}
            {links.length > 0 && (
              <section>
                <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-wider text-[hsl(224,76%,30%)]">
                  Links & Videos
                </h2>
                <div className="flex flex-col gap-1.5">
                  {links.map((doc) => (
                    <a
                      key={doc.id}
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-3 rounded-lg border border-border bg-white px-3 py-2 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
                    >
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                        doc.type === "video"
                          ? "bg-red-50 text-red-600"
                          : "bg-blue-50 text-blue-600"
                      }`}>
                        {doc.type === "video" ? (
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        ) : (
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[hsl(222,47%,11%)]">{doc.title}</p>
                        {doc.description && (
                          <p className="mt-0.5 text-xs text-[hsl(222,47%,11%)]/60">{doc.description}</p>
                        )}
                      </div>
                      <svg className="h-4 w-4 shrink-0 text-[hsl(222,47%,11%)]/20 transition-transform group-hover:translate-x-0.5 group-hover:text-[hsl(224,76%,30%)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  ))}
                </div>
              </section>
            )}

            {/* Files */}
            {files.length > 0 && (
              <section>
                <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-wider text-[hsl(224,76%,30%)]">
                  Documents
                </h2>
                <div className="flex flex-col gap-1.5">
                  {files.map((doc) => {
                    const fileUrl = doc.url || (doc.file_path
                      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/athlete-documents/${doc.file_path}`
                      : "#")

                    return (
                      <a
                        key={doc.id}
                        href={fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center gap-3 rounded-lg border border-border bg-white px-3 py-2 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-600">
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-[hsl(222,47%,11%)]">{doc.title}</p>
                          {doc.description && (
                            <p className="mt-0.5 text-xs text-[hsl(222,47%,11%)]/60">{doc.description}</p>
                          )}
                          {doc.file_name && (
                            <p className="mt-0.5 text-[10px] text-[hsl(222,47%,11%)]/40">{doc.file_name}</p>
                          )}
                        </div>
                        <svg className="h-4 w-4 shrink-0 text-[hsl(222,47%,11%)]/20 transition-transform group-hover:translate-y-0.5 group-hover:text-[hsl(224,76%,30%)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </a>
                    )
                  })}
                </div>
              </section>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-white p-12 text-center shadow-sm">
            <p className="text-sm text-[hsl(222,47%,11%)]/60">
              No documents have been shared yet.
            </p>
          </div>
        )}

        {/* Footer branding */}
        <div className="mt-12 flex flex-col items-center gap-2 text-center">
          <div className="relative h-10 w-10 opacity-40">
            <Image
              src="/logo.png"
              alt="Gridiron Elite Recruiting"
              fill
              className="object-contain"
            />
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[hsl(222,47%,11%)]/30">
            Powered by Gridiron Elite Recruiting
          </p>
        </div>
      </main>
    </div>
  )
}
