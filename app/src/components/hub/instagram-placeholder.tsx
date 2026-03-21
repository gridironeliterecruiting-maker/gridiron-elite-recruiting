"use client"

import { Card } from "@/components/ui/card"
import { ExternalLink } from "lucide-react"

interface InstagramCardProps {
  instagramHandle: string | null
  firstName: string | null
  lastName: string | null
  position: string | null
  gradYear: number | null
}

export function InstagramPlaceholder({
  instagramHandle,
  firstName,
  lastName,
  position,
  gradYear,
}: InstagramCardProps) {
  const instagramUrl = instagramHandle
    ? `https://www.instagram.com/${instagramHandle.replace(/^@/, "")}/`
    : null

  return (
    <Card className="overflow-hidden">
      {/* Instagram gradient header bar */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{
          background:
            "linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)",
        }}
      >
        <div className="flex items-center gap-2">
          {/* Instagram camera icon SVG */}
          <svg
            viewBox="0 0 24 24"
            fill="white"
            className="h-4 w-4 shrink-0"
            aria-hidden="true"
          >
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
          </svg>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white">
            Instagram
          </p>
        </div>
        {instagramHandle && instagramUrl && (
          <a
            href={instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] font-semibold text-white/70 transition-colors hover:text-white"
          >
            Open Instagram
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      <div className="p-5 sm:p-6">
        {instagramHandle ? (
          <div className="flex flex-col gap-4">
            {/* Athlete identity */}
            <div className="flex items-center gap-3">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white font-bold text-base"
                style={{
                  background:
                    "linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)",
                }}
              >
                {firstName?.[0] ?? "?"}
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">
                  {firstName} {lastName}
                </p>
                <p className="text-xs text-muted-foreground">
                  @{instagramHandle.replace(/^@/, "")}
                  {position && gradYear ? ` · ${position} · ${gradYear}` : position ? ` · ${position}` : gradYear ? ` · ${gradYear}` : ""}
                </p>
              </div>
            </div>

            {/* Coaching advice */}
            <p className="text-xs text-muted-foreground leading-relaxed">
              Coaches check your IG too — boost your brand by sharing highlights, extra-curriculars, public service, anything that tells the right story.
            </p>

            {/* Open Instagram CTA */}
            <a
              href={instagramUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="self-center rounded-lg px-6 py-2 text-xs font-bold uppercase tracking-wider text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#fcb045" }}
            >
              Open Instagram
            </a>
          </div>
        ) : (
          /* No handle set — prompt to add it */
          <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border py-8 text-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full"
              style={{
                background:
                  "linear-gradient(135deg, rgba(131,58,180,0.15) 0%, rgba(253,29,29,0.15) 50%, rgba(252,176,69,0.15) 100%)",
              }}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-7 w-7"
                style={{ fill: "#c13584" }}
                aria-hidden="true"
              >
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Add Your Instagram
              </p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                Coaches check your IG too — add your handle in{" "}
                <a href="/profile" className="font-semibold text-primary hover:underline">
                  Profile Settings
                </a>{" "}
                to activate this card.
              </p>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
