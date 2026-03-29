"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Inbox,
  Send,
  Reply,
  Archive,
  Loader2,
  Mail,
  Trash2,
  Plus,
  ChevronLeft,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { RecruitingEmailBadge } from "@/components/recruiting-email-badge"

// ─── Types ───────────────────────────────────────────────────────────────────

interface Thread {
  threadId: string        // Zoho native thread ID — stable, used for archive keying
  latestMessageId: string // Latest message ID — used for mark-as-read
  subject: string
  latestAt: string
  otherName: string
  otherEmail: string
  snippet: string
  unreadCount: number
  messageCount: number
  hasUnread: boolean
  latestReceivedId: string
  logoUrl: string | null
  schoolName: string | null
}

interface ThreadMessage {
  id: string
  from_name: string
  from_email: string
  subject: string
  body: string
  snippet: string
  received_at: string
  is_sent: boolean
  is_read: boolean
}

// Archived thread = same as Thread but with programName attached
interface ArchivedThread extends Thread {
  programName: string | null
}

// ─── Session-level thread body cache ─────────────────────────────────────────
// Caches full message arrays by threadId for the duration of the browser session.
// Reopening a thread that was previously viewed makes zero Zoho API calls.
const threadBodyCache = new Map<string, ThreadMessage[]>()

interface ArchiveProgram {
  programName: string
  threads: ArchivedThread[]
  unreadCount: number
}

// Nav state: "inbox" or a program name from archives
type NavSelection = { type: "inbox" } | { type: "archive"; programName: string }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(ts: string | null): string {
  if (!ts) return ""
  const d = new Date(ts)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  if (diffDays === 0) return time
  if (diffDays < 7) return `${d.toLocaleDateString([], { weekday: "short" })} ${time}`
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`
}

// ─── Program Logo (matches coaches/pipeline pages exactly) ────────────────────

function ThreadLogo({ logoUrl, schoolName, otherName }: {
  logoUrl: string | null
  schoolName: string | null
  otherName: string
}) {
  const [imgError, setImgError] = useState(false)
  const initials = (schoolName || otherName).slice(0, 2).toUpperCase()

  if (logoUrl && !imgError) {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white ring-1 ring-primary/20 overflow-hidden">
        <img
          src={logoUrl}
          alt={schoolName || otherName}
          width={32}
          height={32}
          className="object-contain"
          onError={() => setImgError(true)}
        />
      </div>
    )
  }
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold text-primary ring-1 ring-primary/20">
      {initials}
    </div>
  )
}

// ─── Thread List Row ──────────────────────────────────────────────────────────

function ThreadRow({ thread, selected, onClick }: {
  thread: Thread
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 border-b border-border text-left transition-all hover:bg-muted/50 hover:shadow-sm hover:translate-x-0.5",
        selected && "bg-primary/5 border-l-2 border-l-primary",
        thread.hasUnread && !selected && "bg-blue-50/50"
      )}
    >
      <ThreadLogo logoUrl={thread.logoUrl} schoolName={thread.schoolName} otherName={thread.otherName} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={cn(
            "truncate text-sm",
            thread.hasUnread ? "font-bold text-foreground" : "font-medium text-foreground"
          )}>
            {thread.otherName}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">{formatDate(thread.latestAt)}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {thread.hasUnread && (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
          )}
          <span className={cn(
            "truncate text-xs",
            thread.hasUnread ? "font-semibold text-foreground" : "text-muted-foreground"
          )}>
            {thread.subject}
          </span>
          {thread.hasUnread && thread.unreadCount > 0 && (
            <span className="shrink-0 ml-2 text-[10px] font-bold text-blue-600">{thread.unreadCount} new</span>
          )}
        </div>
      </div>
    </button>
  )
}

// ─── Conversation View ────────────────────────────────────────────────────────

function ConversationView({ thread, onBack, onArchived, onDeleted, isArchived = false }: {
  thread: Thread
  onBack: () => void
  onArchived: (threadId: string) => void
  onDeleted: (threadId: string) => void
  isArchived?: boolean
}) {
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [showReply, setShowReply] = useState(false)
  const [replyBody, setReplyBody] = useState("")
  const [sending, setSending] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadThread = useCallback(async () => {
    // Serve from session cache if available — zero Zoho calls for previously viewed threads
    if (threadBodyCache.has(thread.threadId)) {
      setMessages(threadBodyCache.get(thread.threadId)!)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/email/thread/${encodeURIComponent(thread.threadId)}`)
      if (res.ok) {
        const data = await res.json()
        const msgs: ThreadMessage[] = data.messages || []
        threadBodyCache.set(thread.threadId, msgs)
        setMessages(msgs)
      }
    } finally {
      setLoading(false)
    }
  }, [thread.threadId])

  useEffect(() => { loadThread() }, [loadThread])

  // Scroll to bottom (newest message) when thread loads or reply is added
  useEffect(() => {
    if (!loading) {
      bottomRef.current?.scrollIntoView({ behavior: "auto" })
    }
  }, [loading, messages.length])

  // Auto-focus reply textarea when reply opens, scroll into view
  useEffect(() => {
    if (showReply) {
      replyTextareaRef.current?.focus()
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50)
    }
  }, [showReply])

  // Mark all unread messages as read when thread is opened
  useEffect(() => {
    const unreadMessages = messages.filter(m => !m.is_read && !m.is_sent)
    if (unreadMessages.length > 0) {
      // Mark each unread message individually
      for (const msg of unreadMessages) {
        fetch(`/api/email/inbox/${encodeURIComponent(msg.id)}/read`, { method: "PATCH" }).catch(() => {})
      }
      // Update local state so the unread indicator disappears immediately
      thread.hasUnread = false
      thread.unreadCount = 0
    }
  }, [messages, thread])

  const handleReply = async () => {
    if (!replyBody.trim()) return
    const latestReceived = [...messages].reverse().find(m => !m.is_sent)
    const toEmail = latestReceived?.from_email || thread.otherEmail
    const toName = latestReceived?.from_name || thread.otherName

    setSending(true)
    try {
      const res = await fetch("/api/email/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gmailMessageId: latestReceived?.id || thread.latestReceivedId,
          threadId: thread.threadId,
          toEmail,
          toName,
          replyBody,
        }),
      })
      if (res.ok) {
        setReplyBody("")
        setShowReply(false)
        setTimeout(() => {
          threadBodyCache.delete(thread.threadId) // Invalidate so reply is fetched fresh
          loadThread()
        }, 1000)
      } else {
        const err = await res.json()
        alert(err.error || "Failed to send reply")
      }
    } catch {
      alert("Network error. Please try again.")
    } finally {
      setSending(false)
    }
  }

  const handleArchive = async () => {
    setArchiving(true)
    try {
      if (isArchived) {
        // Move back to inbox — delete from filed_emails by thread ID
        await fetch("/api/email/unarchive", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            threadId: thread.threadId,
            fromEmail: thread.otherEmail,
          }),
        })
      } else {
        // Archive — file by Zoho thread ID so future lookups are exact
        await fetch("/api/email/file", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messageId: thread.latestReceivedId,
            threadId: thread.threadId,
            fromEmail: thread.otherEmail,
            fromName: thread.otherName,
            subject: thread.subject,
            snippet: thread.snippet,
            receivedAt: thread.latestAt,
            coachName: thread.otherName,
            programName: thread.schoolName || null,
          }),
        })
      }
      onArchived(thread.threadId)
    } catch {
      alert("Network error. Please try again.")
    } finally {
      setArchiving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm("Delete this conversation?")) return
    setDeleting(true)
    if (thread.latestReceivedId) {
      await fetch("/api/email/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gmailMessageId: thread.latestReceivedId }),
      }).catch(() => {})
    }
    setDeleting(false)
    onDeleted(thread.threadId)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Pinned action bar */}
      <div className="shrink-0 border-b border-border bg-card px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors shrink-0"
          aria-label="Back to inbox"
        >
          <ChevronLeft className="h-5 w-5" />
          Back
        </button>
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-sm text-foreground truncate block">{thread.subject}</span>
          <span className="text-xs text-muted-foreground">{messages.length > 0 ? `${messages.length} message${messages.length !== 1 ? 's' : ''}` : ''}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Delete
          </button>
          <button
            onClick={handleArchive}
            disabled={archiving}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            {archiving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isArchived ? <Inbox className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
            {isArchived ? "Move to Inbox" : "Archive"}
          </button>
          <button
            onClick={() => setShowReply(r => !r)}
            className="flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Reply className="h-3.5 w-3.5" />
            Reply
          </button>
        </div>
      </div>

      {/* Scrollable conversation */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className={cn("max-w-[75%] rounded-2xl p-4", i % 2 === 0 ? "mr-auto" : "ml-auto bg-primary/5")}>
                <Skeleton className="h-3 w-24 mb-2" />
                <Skeleton className="h-3 w-full mb-1" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No messages found.</p>
        ) : (
          messages.map((msg, i) => (
            <div
              key={msg.id || i}
              className={cn(
                "max-w-[75%] rounded-2xl px-4 py-3",
                msg.is_sent
                  ? "ml-auto bg-primary/10 border border-primary/30"        // athlete — right, blue tint + blue border
                  : "mr-auto bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30"  // coach — left, light red + red border
              )}
            >
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-[11px] font-semibold text-muted-foreground">
                  {msg.is_sent ? "Me" : thread.otherName || msg.from_name || msg.from_email}
                </span>
                <span className="text-[10px] text-muted-foreground/70 ml-auto">
                  {formatDate(msg.received_at)}
                </span>
              </div>
              <p className="text-sm text-foreground leading-normal whitespace-pre-line">
                {(msg.body || msg.snippet || "(No content)").replace(/\n{2,}/g, '\n')}
              </p>
            </div>
          ))
        )}

        {/* Reply compose — inside scrollable area, like Gmail */}
        {showReply && (
          <div className="mt-2 rounded-2xl border border-primary/30 bg-card p-4 shadow-sm">
            <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Reply to {thread.otherName}
            </p>
            <textarea
              ref={replyTextareaRef}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              rows={4}
              placeholder="Type your reply..."
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleReply() }}
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">Ctrl+Enter to send</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setShowReply(false); setReplyBody("") }}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleReply}
                  disabled={sending || !replyBody.trim()}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {sending
                    ? <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" />Sending...</>
                    : <><Send className="mr-1.5 h-3 w-3" />Send Reply</>
                  }
                </Button>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}

// ─── Inbox View ──────────────────────────────────────────────────────────────

function InboxView({ onUnreadCountChange, onArchivedThreadsUpdate, isActive, refreshTrigger }: {
  onUnreadCountChange?: (count: number) => void
  onArchivedThreadsUpdate?: (threads: ArchivedThread[]) => void
  isActive?: boolean
  refreshTrigger?: number
}) {
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const isFirstLoad = useRef(true)
  const prevLatestIdRef = useRef<string | null>(null)
  const listScrollRef = useRef<HTMLDivElement>(null)
  const savedScrollTop = useRef(0)

  // Full inbox refresh — calls Zoho. Only on initial load or when new email detected.
  const loadInbox = useCallback(async () => {
    const firstLoad = isFirstLoad.current
    if (firstLoad) setLoading(true)
    try {
      const res = await fetch("/api/email/inbox")
      if (res.ok) {
        const data = await res.json()
        const incoming: Thread[] = data.threads || []
        const archived: ArchivedThread[] = data.archivedThreads || []

        setThreads(incoming)
        setSelectedThread(prev => {
          if (!prev) return prev
          return incoming.find(t => t.threadId === prev.threadId) || prev
        })

        const unreadCount = incoming.reduce((sum, t) => sum + t.unreadCount, 0)
        onUnreadCountChange?.(unreadCount)
        onArchivedThreadsUpdate?.(archived)
      }
    } finally {
      if (firstLoad) {
        isFirstLoad.current = false
        setLoading(false)
      }
    }
  }, [onUnreadCountChange, onArchivedThreadsUpdate])

  // Initial load — one Zoho call
  useEffect(() => {
    loadInbox()
  }, [loadInbox])

  // Poll OUR database every 30s — never hits Zoho. Only triggers
  // a Zoho refresh when a genuinely new email notification is found.
  const lastCheckedRef = useRef<string | null>(null)
  useEffect(() => {
    const checkNew = async () => {
      try {
        const url = lastCheckedRef.current
          ? `/api/email/check-new?since=${encodeURIComponent(lastCheckedRef.current)}`
          : "/api/email/check-new"
        const res = await fetch(url)
        if (!res.ok) return
        const data = await res.json()

        if (lastCheckedRef.current && data.newCount > 0) {
          // New email detected in our DB — now refresh from Zoho
          const from = data.latestFrom || ""
          const name = from.includes("<") ? from.split("<")[0].trim().replace(/"/g, "") : from.split("@")[0]
          setToast(`New email from ${name}`)
          loadInbox()
        }

        if (data.latestAt) lastCheckedRef.current = data.latestAt
      } catch {
        // Non-critical
      }
    }

    // Initial baseline (don't trigger refresh — loadInbox already ran)
    fetch("/api/email/check-new").then(r => r.json()).then(d => {
      if (d.latestAt) lastCheckedRef.current = d.latestAt
    }).catch(() => {})

    const interval = setInterval(checkNew, 30000)
    return () => clearInterval(interval)
  }, [loadInbox])

  // Reset thread view when nav switches back to inbox
  useEffect(() => {
    if (isActive) setSelectedThread(null)
  }, [isActive])

  // Refresh inbox when a thread is moved back from archive
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) loadInbox()
  }, [refreshTrigger, loadInbox])

  // Auto-dismiss toast after 5 seconds
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(timer)
  }, [toast])

  const handleSelectThread = (thread: Thread) => {
    // Save scroll position before navigating into thread
    savedScrollTop.current = listScrollRef.current?.scrollTop || 0
    setSelectedThread(thread)
    // Mark unread locally and update parent badge immediately
    if (thread.hasUnread) {
      setThreads(prev => {
        const updated = prev.map(t =>
          t.threadId === thread.threadId ? { ...t, hasUnread: false, unreadCount: 0 } : t
        )
        const newUnread = updated.reduce((sum, t) => sum + t.unreadCount, 0)
        onUnreadCountChange?.(newUnread)
        return updated
      })
    }
  }

  const handleBack = () => {
    setSelectedThread(null)
    // Restore scroll position
    requestAnimationFrame(() => {
      if (listScrollRef.current) {
        listScrollRef.current.scrollTop = savedScrollTop.current
      }
    })
  }

  const handleArchived = (threadId: string) => {
    setThreads(prev => prev.filter(t => t.threadId !== threadId))
    setSelectedThread(null)
    // Re-fetch inbox so archived threads list updates
    loadInbox()
  }

  const handleDeleted = (threadId: string) => {
    setThreads(prev => prev.filter(t => t.threadId !== threadId))
    setSelectedThread(null)
  }

  if (loading) {
    return (
      <div className="h-full">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-border px-4 py-3">
            <Skeleton className="h-9 w-9 rounded-md shrink-0" />
            <div className="flex-1">
              <div className="flex justify-between mb-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-10" />
              </div>
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Thread view — takes over entire content area
  if (selectedThread) {
    return (
      <ConversationView
        thread={selectedThread}
        onBack={handleBack}
        onArchived={handleArchived}
        onDeleted={handleDeleted}
      />
    )
  }

  // List view — takes over entire content area
  if (threads.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center py-16 text-center px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Inbox className="h-8 w-8 text-muted-foreground/40" />
        </div>
        <p className="mt-4 text-sm font-medium text-muted-foreground">
          Your inbox is empty. Send your recruiting email to coaches and their replies will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="relative h-full overflow-y-auto" ref={listScrollRef}>
      {/* Toast notification for new email */}
      {toast && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top fade-in bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg text-sm font-medium">
          {toast}
        </div>
      )}
      {threads.map(thread => (
        <ThreadRow
          key={thread.threadId}
          thread={thread}
          selected={false}
          onClick={() => handleSelectThread(thread)}
        />
      ))}
    </div>
  )
}

// ─── Archive Program View — identical functionality to InboxView ──────────────

function ArchiveProgramView({ program, onMovedToInbox, onUnreadCleared }: { program: ArchiveProgram; onMovedToInbox?: (threadId: string) => void; onUnreadCleared?: (count: number) => void }) {
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null)
  const [threads, setThreads] = useState(program.threads)
  const listScrollRef = useRef<HTMLDivElement>(null)
  const savedScrollTop = useRef(0)

  // Keep threads in sync when program data updates from polling
  useEffect(() => {
    setThreads(program.threads)
  }, [program.threads])

  const handleSelectThread = (thread: Thread) => {
    savedScrollTop.current = listScrollRef.current?.scrollTop || 0
    setSelectedThread(thread)
    // Clear unread locally and update program badge immediately
    if (thread.hasUnread) {
      const cleared = thread.unreadCount
      setThreads(prev => prev.map(t =>
        t.threadId === thread.threadId ? { ...t, hasUnread: false, unreadCount: 0 } : t
      ))
      onUnreadCleared?.(cleared)
    }
  }

  const handleBack = () => {
    setSelectedThread(null)
    requestAnimationFrame(() => {
      if (listScrollRef.current) {
        listScrollRef.current.scrollTop = savedScrollTop.current
      }
    })
  }

  const handleMovedToInbox = (threadId: string) => {
    setThreads(prev => prev.filter(t => t.threadId !== threadId))
    setSelectedThread(null)
    onMovedToInbox?.(threadId)
  }

  if (threads.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center py-16 text-center px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Archive className="h-8 w-8 text-muted-foreground/40" />
        </div>
        <p className="mt-4 text-sm font-medium text-muted-foreground">
          No archived emails from {program.programName}.
        </p>
      </div>
    )
  }

  // Thread detail — full ConversationView, identical to inbox
  if (selectedThread) {
    return (
      <ConversationView
        thread={selectedThread}
        onBack={handleBack}
        onArchived={handleMovedToInbox}
        onDeleted={(id) => { setThreads(prev => prev.filter(t => t.threadId !== id)); setSelectedThread(null) }}
        isArchived
      />
    )
  }

  // Thread list — same ThreadRow as inbox
  return (
    <div className="h-full overflow-y-auto" ref={listScrollRef}>
      {program.threads.map(thread => (
        <ThreadRow
          key={thread.threadId}
          thread={thread}
          selected={false}
          onClick={() => handleSelectThread(thread)}
        />
      ))}
    </div>
  )
}

// ─── Main EmailClient ─────────────────────────────────────────────────────────

export function EmailClient({ recruitingEmail }: { recruitingEmail?: string | null }) {
  const [nav, setNav] = useState<NavSelection>({ type: "inbox" })
  const [unreadCount, setUnreadCount] = useState(0)
  const [archivePrograms, setArchivePrograms] = useState<ArchiveProgram[]>([])
  const [inboxRefreshTrigger, setInboxRefreshTrigger] = useState(0)

  // Build archive programs from archived threads returned by inbox API
  const handleArchivedThreadsUpdate = useCallback((archivedThreads: ArchivedThread[]) => {
    const programMap = new Map<string, ArchivedThread[]>()
    for (const t of archivedThreads) {
      const key = t.programName || t.schoolName || t.otherName || 'Other'
      const existing = programMap.get(key) || []
      existing.push(t)
      programMap.set(key, existing)
    }
    const programs: ArchiveProgram[] = [...programMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, threads]) => ({
        programName: name,
        threads,
        unreadCount: threads.reduce((sum, t) => sum + t.unreadCount, 0),
      }))
    setArchivePrograms(programs)
  }, [])

  const isInbox = nav.type === "inbox"
  const selectedProgram = nav.type === "archive"
    ? archivePrograms.find(p => p.programName === nav.programName) || null
    : null

  return (
    <div className="flex flex-col -mx-4 -my-6 lg:-mx-8 lg:-my-8 h-[calc(100vh-4rem)] overflow-hidden">
      {/* Page header — pinned */}
      <div className="shrink-0 border-b border-border bg-card px-4 pb-4 pt-6 lg:px-8 lg:pt-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-foreground sm:text-3xl">Email</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Mail className="h-3.5 w-3.5 text-accent" />
              FOLLOW UP. BUILD RELATIONSHIPS.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {recruitingEmail && <RecruitingEmailBadge email={recruitingEmail} />}
            <Button
              onClick={() => {
                const segs = window.location.pathname.split('/').filter(Boolean)
                const appRoutes = ['hub', 'coaches', 'pipeline', 'outreach', 'profile', 'email']
                const base = segs.length >= 2 && appRoutes.includes(segs[1]) ? `/${segs[0]}` : ''
                window.location.href = `${base}/outreach?quickEmail=true`
              }}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <Plus className="h-4 w-4" />
              Create Campaign
            </Button>
          </div>
        </div>
      </div>

      {/* Main — pinned sidebar + scrollable content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left nav — pinned */}
        <nav className="flex w-[72px] shrink-0 flex-col border-r border-border bg-card py-2 md:w-48 overflow-y-auto">
          {/* Inbox row */}
          <button
            onClick={() => setNav({ type: "inbox" })}
            className={cn(
              "relative flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors md:px-4",
              isInbox
                ? "bg-primary/10 text-primary font-semibold border-l-2 border-primary"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            <Inbox className="h-4 w-4 shrink-0" />
            <span className="hidden md:inline">Inbox</span>
            {unreadCount > 0 && (
              <Badge className="ml-auto hidden h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-accent p-0 text-[10px] font-bold text-white md:flex">
                {unreadCount > 99 ? "99+" : unreadCount}
              </Badge>
            )}
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-accent md:hidden" />
            )}
          </button>

          {/* Archives section */}
          <div className="mt-3 border-t border-border pt-2">
            {/* Archives label — static, not clickable */}
            <div className="flex items-center gap-2 px-3 py-1.5 md:px-4">
              <Archive className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
              <span className="hidden md:inline text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                Archives
              </span>
            </div>

            {/* Program list */}
            {archivePrograms.length === 0 ? (
              <p className="hidden md:block px-4 py-2 text-[10px] text-muted-foreground/50">
                No archived emails yet
              </p>
            ) : (
              archivePrograms.map(prog => {
                const isSelected = nav.type === "archive" && nav.programName === prog.programName
                return (
                  <button
                    key={prog.programName}
                    onClick={() => setNav({ type: "archive", programName: prog.programName })}
                    className={cn(
                      "relative flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors md:px-4",
                      isSelected
                        ? "bg-primary/10 text-primary font-semibold border-l-2 border-primary"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    <span className="hidden md:inline truncate text-xs">{prog.programName}</span>
                    {prog.unreadCount > 0 && (
                      <Badge className="ml-auto hidden h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 p-0 text-[10px] font-bold text-white md:flex">
                        {prog.unreadCount > 99 ? "99+" : prog.unreadCount}
                      </Badge>
                    )}
                    {prog.unreadCount > 0 && (
                      <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500 md:hidden" />
                    )}
                  </button>
                )
              })
            )}
          </div>
        </nav>

        {/* Content — fills rest, overflow managed internally */}
        <div className="flex-1 min-w-0 min-h-0 overflow-hidden bg-background">
          {/* InboxView always mounted to keep 30s polling alive for archive updates */}
          <div className={isInbox ? "h-full" : "hidden"}>
            <InboxView
              onUnreadCountChange={setUnreadCount}
              onArchivedThreadsUpdate={handleArchivedThreadsUpdate}
              isActive={isInbox}
              refreshTrigger={inboxRefreshTrigger}
            />
          </div>
          {selectedProgram && (
            <ArchiveProgramView
              key={selectedProgram.programName}
              program={selectedProgram}
              onMovedToInbox={(threadId) => {
                // Remove from archive state immediately so folder doesn't re-show it
                setArchivePrograms(prev => prev.map(p =>
                  p.programName === selectedProgram.programName
                    ? { ...p, threads: p.threads.filter(t => t.threadId !== threadId) }
                    : p
                ))
                // Trigger inbox refresh so the thread appears there
                setInboxRefreshTrigger(n => n + 1)
              }}
              onUnreadCleared={(count) => {
                // Immediately deduct from the program's badge
                setArchivePrograms(prev => prev.map(p =>
                  p.programName === selectedProgram.programName
                    ? { ...p, unreadCount: Math.max(0, p.unreadCount - count) }
                    : p
                ))
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
