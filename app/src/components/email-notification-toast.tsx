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
  const prevArchivedLatestIdRef = useRef<string | null>(null)
  const initializedRef = useRef(false)

  useEffect(() => {
    const checkForNewEmail = async () => {
      try {
        const res = await fetch("/api/email/inbox")
        if (!res.ok) return
        const data = await res.json()
        const threads = data.threads || []
        const archivedThreads = data.archivedThreads || []

        // Combine both for "latest" detection
        const allThreads = [...threads, ...archivedThreads]
          .sort((a: any, b: any) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime())

        const latestInbox = threads[0]?.threadId || null
        const latestArchived = archivedThreads[0]?.threadId || null

        if (!initializedRef.current) {
          prevLatestIdRef.current = latestInbox
          prevArchivedLatestIdRef.current = latestArchived
          initializedRef.current = true
          return
        }

        // Check inbox for new email
        if (latestInbox && prevLatestIdRef.current && latestInbox !== prevLatestIdRef.current) {
          setToast(`New email from ${threads[0].otherName}`)
        }
        // Check archived threads for new email
        else if (latestArchived && prevArchivedLatestIdRef.current && latestArchived !== prevArchivedLatestIdRef.current) {
          setToast(`New email from ${archivedThreads[0].otherName}`)
        }

        prevLatestIdRef.current = latestInbox
        prevArchivedLatestIdRef.current = latestArchived
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
