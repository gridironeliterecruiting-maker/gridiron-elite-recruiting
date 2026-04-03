"use client"

import Link from "next/link"
import { AlertTriangle } from "lucide-react"

export function IncompleteProfileBanner({
  missingFields,
  basePath = "",
}: {
  missingFields: string[]
  basePath?: string
}) {
  if (missingFields.length === 0) return null

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-900">
            Complete your profile to send campaigns
          </p>
          <p className="mt-0.5 text-sm text-amber-700">
            Campaign emails use your profile info to personalize messages. Missing fields will appear
            as blank spaces in your emails. Fill in:{" "}
            <span className="font-medium">{missingFields.join(", ")}</span>
          </p>
          <Link
            href={`${basePath}/profile`}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700"
          >
            Complete Profile
          </Link>
        </div>
      </div>
    </div>
  )
}
