"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Inbox,
  Send,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Folder,
  User,
  Reply,
  Archive,
  Loader2,
  Mail,
  ArrowLeft,
  Building2,
  Trash2,
  Plus,
  ChevronLeft,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient as createBrowserSupabase } from "@/lib/supabase/client"
import { createClient } from "@supabase/supabase-js"

// Realtime client — created once at module level per Supabase docs.
// Uses plain createClient (not createBrowserClient) to avoid SSR cookie/auth overhead.
const realtimeClient = typeof window !== 'undefined'
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false, storageKey: 'sb-realtime', storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } } }
    )
  : null
import { RecruitingEmailBadge } from "@/components/recruiting-email-badge"

// ─── Types ───────────────────────────────────────────────────────────────────

interface Thread {
  threadId: string
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

interface FolderEmail {
  id: string
  thread_id: string | null
  from_name: string | null
  from_email: string | null
  coach_name: string | null
  program_name: string | null
  subject: string
  snippet: string
  received_at: string | null
  filed_at: string
}

interface CoachFolder { coach_id: string | null; coach_name: string; emails: FolderEmail[] }
interface SchoolFolder { program_id: string | null; school_name: string; coaches: CoachFolder[] }
interface ConferenceFolder { conference: string; schools: SchoolFolder[] }
interface DivisionFolder { division: string; conferences: ConferenceFolder[] }

type Tab = "inbox" | "folders"

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
        "w-full flex items-center gap-3 px-4 py-3 border-b border-border text-left transition-colors hover:bg-muted/40",
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
          <span className="shrink-0 ml-2 text-[10px] text-muted-foreground/60">{thread.messageCount} msg{thread.messageCount !== 1 ? "s" : ""}</span>
        </div>
      </div>
    </button>
  )
}

// ─── Conversation View ────────────────────────────────────────────────────────

function ConversationView({ thread, onBack, onArchived, onDeleted }: {
  thread: Thread
  onBack: () => void
  onArchived: (threadId: string) => void
  onDeleted: (threadId: string) => void
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
    setLoading(true)
    try {
      const res = await fetch(`/api/email/thread/${encodeURIComponent(thread.threadId)}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
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
        setTimeout(() => loadThread(), 1000)
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
      await fetch("/api/email/file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gmailMessageId: thread.latestReceivedId,
          threadId: thread.threadId,
          fromEmail: thread.otherEmail,
          fromName: thread.otherName,
          subject: thread.subject,
          snippet: thread.snippet,
          receivedAt: thread.latestAt,
        }),
      })
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
          <span className="text-xs text-muted-foreground">{thread.messageCount} message{thread.messageCount !== 1 ? "s" : ""}</span>
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
            {archiving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
            Archive
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

function InboxView() {
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null)
  const isFirstLoad = useRef(true)
  const listScrollRef = useRef<HTMLDivElement>(null)
  const savedScrollTop = useRef(0)

  const loadInbox = useCallback(async () => {
    const firstLoad = isFirstLoad.current
    if (firstLoad) setLoading(true)
    try {
      const res = await fetch("/api/email/inbox")
      if (res.ok) {
        const data = await res.json()
        const incoming: Thread[] = data.threads || []
        setThreads(incoming)
        setSelectedThread(prev => {
          if (!prev) return prev
          return incoming.find(t => t.threadId === prev.threadId) || prev
        })
      }
    } finally {
      if (firstLoad) {
        isFirstLoad.current = false
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    loadInbox()

    // Subscribe to Supabase Realtime broadcast for instant inbox updates
    // Uses module-level realtimeClient (plain createClient, no SSR auth)
    if (!realtimeClient) return

    const ssrClient = createBrowserSupabase()
    let channel: ReturnType<typeof realtimeClient.channel> | null = null

    ssrClient.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        console.warn('[email] No user session — skipping Realtime subscription')
        return
      }
      const channelName = `new-email-${user.id}`
      console.log('[email] Subscribing to broadcast channel:', channelName)

      channel = realtimeClient
        .channel(channelName)
        .on('broadcast', { event: 'new_email' }, (payload) => {
          console.log('[email] New email broadcast received!', payload)
          loadInbox()
        })
        .subscribe((status) => {
          console.log('[email] Realtime subscription status:', status)
        })
    })

    return () => {
      if (channel) realtimeClient.removeChannel(channel)
    }
  }, [loadInbox])

  const handleSelectThread = (thread: Thread) => {
    // Save scroll position before navigating into thread
    savedScrollTop.current = listScrollRef.current?.scrollTop || 0
    setSelectedThread(thread)
    // Mark unread locally
    if (thread.hasUnread) {
      setThreads(prev => prev.map(t =>
        t.threadId === thread.threadId ? { ...t, hasUnread: false, unreadCount: 0 } : t
      ))
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
    <div className="h-full overflow-y-auto" ref={listScrollRef}>
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

// ─── Folders View ────────────────────────────────────────────────────────────

function FoldersView() {
  const [divisions, setDivisions] = useState<DivisionFolder[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedDivisions, setExpandedDivisions] = useState<Record<string, boolean>>({})
  const [expandedConferences, setExpandedConferences] = useState<Record<string, boolean>>({})
  const [expandedSchools, setExpandedSchools] = useState<Record<string, boolean>>({})
  const [expandedCoaches, setExpandedCoaches] = useState<Record<string, boolean>>({})
  const [selected, setSelected] = useState<FolderEmail | null>(null)
  const [showReply, setShowReply] = useState(false)
  const [replyBody, setReplyBody] = useState("")
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch("/api/email/folders")
        if (res.ok) {
          const data = await res.json()
          setDivisions(data.divisions || [])
        }
      } finally { setLoading(false) }
    }
    load()
  }, [])

  useEffect(() => {
    if (showReply) replyTextareaRef.current?.focus()
  }, [showReply])

  const toggle = (setter: React.Dispatch<React.SetStateAction<Record<string, boolean>>>, key: string) =>
    setter(prev => ({ ...prev, [key]: !prev[key] }))

  const handleReply = async () => {
    if (!selected || !replyBody.trim() || !selected.from_email) return
    setSending(true)
    try {
      const res = await fetch("/api/email/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gmailMessageId: selected.id,
          threadId: selected.thread_id,
          toEmail: selected.from_email,
          toName: selected.from_name || undefined,
          replyBody,
        }),
      })
      if (res.ok) {
        setSent(true)
        setReplyBody("")
        setShowReply(false)
      } else {
        const err = await res.json()
        alert(err.error || "Failed to send reply")
      }
    } catch {
      alert("Network error. Please try again.")
    } finally { setSending(false) }
  }

  if (loading) {
    return (
      <div className="flex h-full gap-0">
        <div className="w-full md:w-64 border-r border-border p-4">
          <Skeleton className="h-4 w-1/2 mb-3" />
          <Skeleton className="h-3 w-2/3 mb-2 ml-4" />
        </div>
      </div>
    )
  }

  if (divisions.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center py-16 text-center px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <FolderOpen className="h-8 w-8 text-muted-foreground/40" />
        </div>
        <p className="mt-4 text-sm font-medium text-muted-foreground">
          No filed emails yet. Use Archive in your inbox to organize responses.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Folder tree */}
      <div className={cn(
        "flex-col border-r border-border overflow-y-auto w-full md:flex md:w-64 shrink-0",
        selected ? "hidden md:flex" : "flex"
      )}>
        <div className="p-3">
          {divisions.map((div) => {
            const divKey = div.division
            const divOpen = expandedDivisions[divKey] !== false
            return (
              <div key={divKey} className="mb-1">
                <button onClick={() => toggle(setExpandedDivisions, divKey)}
                  className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs font-bold uppercase tracking-wider text-primary hover:bg-primary/5">
                  {divOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                  <Folder className="h-3.5 w-3.5 shrink-0" />
                  {div.division}
                </button>
                {divOpen && div.conferences.map((conf) => {
                  const confKey = `${divKey}-${conf.conference}`
                  const confOpen = expandedConferences[confKey] !== false
                  return (
                    <div key={confKey} className="ml-4">
                      <button onClick={() => toggle(setExpandedConferences, confKey)}
                        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs font-semibold text-foreground hover:bg-muted/50">
                        {confOpen ? <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />}
                        <FolderOpen className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className="truncate">{conf.conference}</span>
                      </button>
                      {confOpen && conf.schools.map((school) => {
                        const schoolKey = `${confKey}-${school.program_id || school.school_name}`
                        const schoolOpen = expandedSchools[schoolKey]
                        return (
                          <div key={schoolKey} className="ml-4">
                            <button onClick={() => toggle(setExpandedSchools, schoolKey)}
                              className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs text-foreground hover:bg-muted/50">
                              {schoolOpen ? <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />}
                              <Building2 className="h-3 w-3 shrink-0 text-muted-foreground" />
                              <span className="truncate">{school.school_name}</span>
                            </button>
                            {schoolOpen && school.coaches.map((coach) => {
                              const coachKey = `${schoolKey}-${coach.coach_id || coach.coach_name}`
                              const coachOpen = expandedCoaches[coachKey]
                              return (
                                <div key={coachKey} className="ml-4">
                                  <button onClick={() => toggle(setExpandedCoaches, coachKey)}
                                    className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs text-muted-foreground hover:bg-muted/50">
                                    {coachOpen ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                                    <User className="h-3 w-3 shrink-0" />
                                    <span className="truncate flex-1">{coach.coach_name}</span>
                                    <span className="ml-auto shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium">{coach.emails.length}</span>
                                  </button>
                                  {coachOpen && coach.emails.map((email) => (
                                    <button key={email.id}
                                      onClick={() => { setSelected(email); setShowReply(false); setSent(false) }}
                                      className={cn(
                                        "ml-4 flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs text-muted-foreground hover:bg-muted/50",
                                        selected?.id === email.id && "bg-primary/5 text-primary font-medium"
                                      )}>
                                      <Mail className="h-3 w-3 shrink-0" />
                                      <span className="truncate flex-1">{email.subject}</span>
                                      <span className="shrink-0 text-[10px]">{email.filed_at ? formatDate(email.filed_at) : ""}</span>
                                    </button>
                                  ))}
                                </div>
                              )
                            })}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* Reading pane */}
      <div className={cn("flex-1 overflow-hidden flex-col min-h-0", selected ? "flex" : "hidden md:flex")}>
        {selected ? (
          <div className="flex h-full flex-col">
            <div className="shrink-0 border-b border-border px-4 py-3 flex items-center gap-3">
              <button onClick={() => setSelected(null)} className="md:hidden text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-semibold text-foreground truncate">{selected.subject}</h2>
                <p className="text-xs text-muted-foreground">
                  {selected.coach_name || selected.from_name || selected.from_email}
                  {selected.received_at && <> · {new Date(selected.received_at).toLocaleString()}</>}
                </p>
              </div>
              {selected.from_email && (
                <button onClick={() => setShowReply(r => !r)}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
                  <Reply className="h-3.5 w-3.5" /> Reply
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {selected.snippet || "(No preview available)"}
              </p>
              {sent && (
                <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                  Reply sent successfully.
                </div>
              )}
              {showReply && (
                <div className="mt-4 rounded-2xl border border-primary/30 bg-card p-4">
                  <textarea ref={replyTextareaRef}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    rows={4} placeholder="Type your reply..." value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)} />
                  <div className="mt-2 flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setShowReply(false); setReplyBody("") }}>Cancel</Button>
                    <Button size="sm" onClick={handleReply} disabled={sending || !replyBody.trim()}
                      className="bg-primary text-primary-foreground hover:bg-primary/90">
                      {sending ? <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" />Sending...</> : <><Send className="mr-1.5 h-3 w-3" />Send</>}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-center">
              <FolderOpen className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Select an email to read</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main EmailClient ─────────────────────────────────────────────────────────

export function EmailClient({ recruitingEmail }: { recruitingEmail?: string | null }) {
  const [tab, setTab] = useState<Tab>("inbox")
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/email/inbox")
        if (res.ok) {
          const data = await res.json()
          setUnreadCount(data.unreadCount || 0)
        }
      } catch { /* non-critical */ }
    }
    load()
    // No polling — unread count updates via Supabase Realtime (same as inbox)
  }, [])

  const tabs: { id: Tab; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: "inbox", label: "Inbox", icon: Inbox, badge: unreadCount },
    { id: "folders", label: "Folders", icon: FolderOpen },
  ]

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
                window.location.href = `${base}/outreach`
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
        <nav className="flex w-[72px] shrink-0 flex-col border-r border-border bg-card py-2 md:w-44">
          {tabs.map(({ id, label, icon: Icon, badge }) => (
            <button key={id} onClick={() => setTab(id)}
              className={cn(
                "relative flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors md:px-4",
                tab === id
                  ? "bg-primary/10 text-primary font-semibold border-l-2 border-primary"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}>
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden md:inline">{label}</span>
              {badge !== undefined && badge > 0 && (
                <Badge className="ml-auto hidden h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-accent p-0 text-[10px] font-bold text-white md:flex">
                  {badge > 99 ? "99+" : badge}
                </Badge>
              )}
              {badge !== undefined && badge > 0 && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-accent md:hidden" />
              )}
            </button>
          ))}
        </nav>

        {/* Content — fills rest, overflow managed internally */}
        <div className="flex-1 min-w-0 min-h-0 overflow-hidden bg-background">
          {tab === "inbox" && <InboxView />}
          {tab === "folders" && <FoldersView />}
        </div>
      </div>
    </div>
  )
}
