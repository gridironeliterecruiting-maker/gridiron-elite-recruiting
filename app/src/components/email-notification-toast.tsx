"use client"

import { useEffect, useRef, useState } from "react"
import { Mail } from "lucide-react"

/**
 * Site-wide email notification toast.
 * Polls OUR database (email_notifications table) every 30 seconds.
 * Never hits Zoho — fast, free, unlimited.
 * Shows a toast when a new email notification is detected.
 */
export function EmailNotificationToast() {
  const [toast, setToast] = useState<string | null>(null)
  const prevLatestAtRef = useRef<string | null>(null)
  const initializedRef = useRef(false)

  useEffect(() => {
    const checkForNewEmail = async () => {
      try {
        const url = prevLatestAtRef.current
          ? `/api/email/check-new?since=${encodeURIComponent(prevLatestAtRef.current)}`
          : "/api/email/check-new"
        const res = await fetch(url)
        if (!res.ok) return
        const data = await res.json()

        if (!initializedRef.current) {
          // First check — record baseline, don't show toast
          prevLatestAtRef.current = data.latestAt
          initializedRef.current = true
          return
        }

        if (data.newCount > 0 && data.latestAt !== prevLatestAtRef.current) {
          // Parse sender name from email address
          const from = data.latestFrom || "a coach"
          const name = from.includes("<") ? from.split("<")[0].trim().replace(/"/g, "") : from.split("@")[0]
          setToast(`New email from ${name}`)
        }

        prevLatestAtRef.current = data.latestAt
      } catch {
        // Non-critical — silently ignore
      }
    }

    checkForNewEmail()
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
