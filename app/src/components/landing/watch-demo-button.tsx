'use client'

import { OVERLAY_ENABLED } from '@/lib/feature-flags'

export function WatchDemoButton() {
  if (!OVERLAY_ENABLED) return null

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event('rr-open-overlay'))}
      className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-white/50 hover:text-white"
    >
      Watch Demo
    </button>
  )
}
