"use client"

import { useEffect, useRef, useState } from "react"
import { Mail } from "lucide-react"

/**
 * Site-wide email notification toast.
 * Polls /api/email/inbox every 30 seconds to detect new emails.
 * Shows a toast notification on any page when a new email arrives.
 * Does NOT refresh the page — purely informational.
 */
export function EmailNotificationToast() {
  const [toast, setToast] = useState<string | null>(null)
  const prevLatestIdRef = useRef<string | null>(null)
  const initializedRef = useRef(false)

  useEffect(() => {
    const checkForNewEmail = async () => {
      try {
        const res = await fetch("/api/email/inbox")
        if (!res.ok) return
        const data = await res.json()
        const threads = data.threads || []
        if (threads.length === 0) return

        const latestId = threads[0].threadId

        if (!initializedRef.current) {
          // First check — just record the baseline, don't show toast
          prevLatestIdRef.current = latestId
          initializedRef.current = true
          return
        }

        if (prevLatestIdRef.current && latestId !== prevLatestIdRef.current) {
          setToast(`New email from ${threads[0].otherName}`)
        }

        prevLatestIdRef.current = latestId
      } catch {
        // Non-critical — silently ignore
      }
    }

    // Initial baseline check
    checkForNewEmail()

    // Poll every 30 seconds
    const interval = setInterval(checkForNewEmail, 30000)
    return () => clearInterval(interval)
  }, [])

  // Auto-dismiss toast after 5 seconds
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(timer)
  }, [toast])

  if (!toast) return null

  return (
    <div className="fixed top-16 right-4 z-[100] animate-in slide-in-from-top-2 fade-in">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 shadow-lg">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Mail className="h-4 w-4" />
        </div>
        <p className="text-sm font-medium text-foreground">{toast}</p>
      </div>
    </div>
  )
}
