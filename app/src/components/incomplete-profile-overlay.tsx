"use client"

import { AlertTriangle, X } from "lucide-react"
import Link from "next/link"

export function IncompleteProfileOverlay({
  missingFields,
  basePath = "",
  onClose,
}: {
  missingFields: string[]
  basePath?: string
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative mx-4 w-full max-w-md rounded-xl bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="mb-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-100">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            </div>
            <h3 className="font-display text-lg font-bold uppercase tracking-tight text-foreground">
              Complete Your Profile
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-secondary text-foreground transition-colors hover:bg-border"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground">
          Your campaign emails and DMs use profile information to personalize every message.
          Missing fields will appear as blank spaces — coaches will notice.
        </p>

        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-800 mb-2">
            Missing Information
          </p>
          <div className="flex flex-wrap gap-1.5">
            {missingFields.map((field) => (
              <span
                key={field}
                className="rounded-full bg-amber-200/60 px-2.5 py-0.5 text-xs font-medium text-amber-900"
              >
                {field}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-md border border-border py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-secondary"
          >
            Cancel
          </button>
          <Link
            href={`${basePath}/profile`}
            className="flex-1 rounded-md bg-primary py-2.5 text-center text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            Go to Profile
          </Link>
        </div>
      </div>
    </div>
  )
}
