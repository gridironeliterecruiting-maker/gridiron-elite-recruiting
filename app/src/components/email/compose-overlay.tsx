"use client"

import { useState, useRef, useEffect } from "react"
import { X, Loader2, Send } from "lucide-react"

interface ComposeOverlayProps {
  onClose: () => void
  onSent: () => void
}

const inputClass =
  "w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"

export function ComposeOverlay({ onClose, onSent }: ComposeOverlayProps) {
  const [toAddress, setToAddress] = useState("")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const toRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    toRef.current?.focus()
  }, [])

  // Ctrl+Enter to send
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSend = async () => {
    if (!toAddress.trim()) {
      setError("Recipient email is required")
      return
    }
    if (!subject.trim()) {
      setError("Subject is required")
      return
    }
    if (!body.trim()) {
      setError("Email body is required")
      return
    }

    setSending(true)
    setError("")

    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toAddress: toAddress.trim(),
          subject: subject.trim(),
          body: body.trim(),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Failed to send email")
        setSending(false)
        return
      }

      onSent()
      onClose()
    } catch {
      setError("Network error. Please try again.")
      setSending(false)
    }
  }

  return (
    <div className="animate-in slide-in-from-right-8 fade-in fixed inset-0 z-[80] overflow-y-auto duration-200">
      <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col overflow-hidden bg-card shadow-2xl sm:rounded-l-2xl">
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-foreground transition-colors hover:bg-border hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
          <h3 className="flex-1 font-display text-lg font-bold uppercase tracking-tight text-foreground">
            New Email
          </h3>
          <button
            type="button"
            onClick={handleSend}
            disabled={sending}
            className="flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground transition-colors hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                Send
              </>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col overflow-y-auto px-5 py-6" onKeyDown={handleKeyDown}>
          {error && (
            <div className="mb-4 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* To */}
          <div className="mb-4">
            <label htmlFor="compose-to" className="mb-2 block text-xs font-medium text-foreground">
              To
            </label>
            <input
              ref={toRef}
              id="compose-to"
              type="email"
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
              placeholder="coach@university.edu"
              className={inputClass}
            />
          </div>

          {/* Subject */}
          <div className="mb-4">
            <label htmlFor="compose-subject" className="mb-2 block text-xs font-medium text-foreground">
              Subject
            </label>
            <input
              id="compose-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
              className={inputClass}
            />
          </div>

          {/* Body */}
          <div className="flex flex-1 flex-col">
            <label htmlFor="compose-body" className="mb-2 block text-xs font-medium text-foreground">
              Message
            </label>
            <textarea
              id="compose-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email..."
              className={`${inputClass} flex-1 min-h-[200px] resize-none`}
            />
            <p className="mt-2 text-[10px] text-muted-foreground">Ctrl+Enter to send</p>
          </div>
        </div>
      </div>
    </div>
  )
}
