'use client'

import { useState } from 'react'
import { Mail, Loader2, X } from 'lucide-react'

interface RecruitingEmailOverlayProps {
  proposedEmail: string
  onComplete: (email: string) => void
  onClose: () => void
}

export function RecruitingEmailOverlay({ proposedEmail, onComplete, onClose }: RecruitingEmailOverlayProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/workspace/create', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.')
        return
      }
      onComplete(data.email)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
      <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-8 text-center">
          {/* Icon */}
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
            <Mail className="h-8 w-8 text-accent" />
          </div>

          <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-foreground">
            Set Up Your<br />Recruiting Email
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            You need a dedicated recruiting email to send campaigns to coaches. It takes 2 seconds.
          </p>

          {/* Proposed email */}
          <div className="my-6 rounded-xl border-2 border-primary/20 bg-primary/5 px-4 py-4">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Your recruiting email will be
            </p>
            <p className="text-base font-bold text-primary break-all">{proposedEmail}</p>
          </div>

          {error && (
            <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
          )}

          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full rounded-xl bg-accent py-3.5 font-display text-sm font-bold uppercase tracking-wider text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </span>
            ) : (
              'Create My Recruiting Email'
            )}
          </button>

          <p className="mt-3 text-xs text-muted-foreground">
            One-time setup. You&apos;ll never see this again.
          </p>
        </div>
      </div>
    </div>
  )
}
