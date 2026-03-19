"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { ChevronDown } from "lucide-react"

export interface PipelineProgram {
  programId: string
  schoolName: string
  logoUrl: string | null
  twitterHandle: string
}

export function TargetSchoolsX({ programs }: { programs: PipelineProgram[] }) {
  const [isOpen, setIsOpen] = useState(true)
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({})

  if (programs.length === 0) return null

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setIsOpen(v => !v)}
        className="flex w-full items-center justify-between px-5 py-4 sm:px-6"
      >
        <h3 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wider text-foreground">
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-black font-black text-white" style={{ fontSize: 11 }}>X</span>
          Engage Target Schools
          {!isOpen && (
            <span className="inline-flex items-center rounded bg-secondary px-1.5 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
              {programs.length}
            </span>
          )}
        </h3>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="grid grid-cols-4 gap-2 px-5 pb-5 sm:grid-cols-5 sm:px-6 sm:pb-6 md:grid-cols-6">
          {programs.map(p => (
            <a
              key={p.programId}
              href={`https://x.com/${p.twitterHandle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-center gap-1.5 rounded-lg p-2 text-center transition-colors hover:bg-secondary"
            >
              <div className="relative h-9 w-9 shrink-0">
                {!imgErrors[p.programId] && p.logoUrl ? (
                  <img
                    src={p.logoUrl}
                    alt={p.schoolName}
                    className="h-9 w-9 object-contain"
                    onError={() => setImgErrors(prev => ({ ...prev, [p.programId]: true }))}
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-[10px] font-bold uppercase text-muted-foreground">
                    {p.schoolName.slice(0, 2)}
                  </div>
                )}
                {/* Hover overlay */}
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                  <svg className="h-3.5 w-3.5 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </div>
              </div>
              <span className="line-clamp-2 text-[10px] font-medium leading-tight text-foreground">
                {p.schoolName}
              </span>
            </a>
          ))}
        </div>
      )}
    </Card>
  )
}
