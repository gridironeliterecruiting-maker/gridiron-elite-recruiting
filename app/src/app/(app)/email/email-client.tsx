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
  MailOpen,
  ArrowLeft,
  Building2,
  Trash2,
  Plus,
  MessageSquare,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { RecruitingEmailBadge } from "@/components/recruiting-email-badge"

// ─── Types ───────────────────────────────────────────────────────────────────

interface Thread {
  threadId: string
  subject: string
  latestAt: string
  latestFrom: string
  latestFromEmail: string
  snippet: string
  unreadCount: number
  messageCount: number
  hasUnread: boolean
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

interface CoachFolder {
  coach_id: string | null
  coach_name: string
  emails: FolderEmail[]
}

interface SchoolFolder {
  program_id: string | null
  school_name: string
  coaches: CoachFolder[]
}

interface ConferenceFolder {
  conference: string
  schools: SchoolFolder[]
}

interface DivisionFolder {
  division: string
  conferences: ConferenceFolder[]
}

type Tab = "inbox" | "folders"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(ts: string | null): string {
  if (!ts) return ""
  const d = new Date(ts)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" })
  return d.toLocaleDateString([], { month: "short", day: "numeric" })
}

// ─── Conversation Pane ────────────────────────────────────────────────────────

interface ConversationPaneProps {
  thread: Thread
  workspaceEmail?: string | null
  onClose?: () => void
  onFiled?: (msgId: string) => void
  onDeleted?: (threadId: string) => void
}

function ConversationPane({ thread, workspaceEmail, onClose, onDeleted }: ConversationPaneProps) {
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [showReply, setShowReply] = useState(false)
  const [replyBody, setReplyBody] = useState("")
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [deleting, setDeleting] = useState(false)
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

  useEffect(() => {
    loadThread()
  }, [loadThread])

  // Scroll to bottom when messages load or new message sent
  useEffect(() => {
    if (!loading) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [loading, messages.length])

  // Auto-focus reply textarea when reply opens
  useEffect(() => {
    if (showReply) {
      replyTextareaRef.current?.focus()
    }
  }, [showReply])

  // Mark thread as read when opened
  useEffect(() => {
    const unreadMsg = messages.find(m => !m.is_read && !m.is_sent)
    if (unreadMsg?.id) {
      fetch(`/api/email/inbox/${unreadMsg.id}/read`, { method: "PATCH" }).catch(() => {})
    }
  }, [messages])

  const handleReply = async () => {
    if (!replyBody.trim()) return
    // Find the latest received message to reply to
    const latestReceived = [...messages].reverse().find(m => !m.is_sent)
    const toEmail = latestReceived?.from_email || thread.latestFromEmail
    const toName = latestReceived?.from_name || thread.latestFrom

    setSending(true)
    try {
      const res = await fetch("/api/email/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gmailMessageId: latestReceived?.id || '',
          threadId: thread.threadId,
          toEmail,
          toName,
          replyBody,
        }),
      })
      if (res.ok) {
        setSent(true)
        setReplyBody("")
        setShowReply(false)
        // Reload thread after a short delay to include the sent message
        setTimeout(() => { loadThread(); setSent(false) }, 1500)
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

  const handleDeleteThread = async () => {
    if (!confirm("Delete this entire conversation?")) return
    setDeleting(true)
    // Delete the most recent received message ID we have
    const msgToDelete = messages.find(m => !m.is_sent)
    if (msgToDelete?.id) {
      await fetch("/api/email/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gmailMessageId: msgToDelete.id }),
      }).catch(() => {})
    }
    setDeleting(false)
    onDeleted?.(thread.threadId)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-border p-4 shrink-0">
        <div className="flex-1 min-w-0">
          {onClose && (
            <button
              onClick={onClose}
              className="mb-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground md:hidden"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
          )}
          <h2 className="text-base font-semibold text-foreground truncate">{thread.subject}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {thread.messageCount} message{thread.messageCount !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 ml-3">
          <Button
            size="sm"
            variant="outline"
            onClick={handleDeleteThread}
            disabled={deleting}
            className="gap-1.5 text-xs text-destructive hover:text-destructive"
          >
            {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            DELETE
          </Button>
          <Button
            size="sm"
            onClick={() => setShowReply(!showReply)}
            className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-xs"
          >
            <Reply className="h-3 w-3" />
            Reply
          </Button>
        </div>
      </div>

      {/* Conversation messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {loading ? (
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="rounded-lg border border-border p-4">
                <Skeleton className="h-3 w-1/3 mb-2" />
                <Skeleton className="h-3 w-full mb-1" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No messages found.</p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id || msg.received_at}
              className={cn(
                "rounded-lg border p-4",
                msg.is_sent
                  ? "border-primary/20 bg-primary/5 ml-8"
                  : "border-border bg-card mr-8"
              )}
            >
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <span className={cn(
                  "text-xs font-semibold",
                  msg.is_sent ? "text-primary" : "text-foreground"
                )}>
                  {msg.is_sent ? "Me" : msg.from_name || msg.from_email}
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {formatDate(msg.received_at)}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">
                {msg.body || msg.snippet || "(No content)"}
              </p>
            </div>
          ))
        )}

        {sent && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 text-center">
            Reply sent.
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Reply composer */}
      {showReply && (
        <div className="border-t border-border p-4 shrink-0">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Reply to {thread.latestFrom !== "Me" ? thread.latestFrom : thread.latestFromEmail}
          </p>
          <textarea
            ref={replyTextareaRef}
            className="w-full rounded-md border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            rows={4}
            placeholder="Type your reply..."
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleReply()
            }}
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[10px] text-muted-foreground">Ctrl+Enter to send</p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => { setShowReply(false); setReplyBody("") }}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleReply}
                disabled={sending || !replyBody.trim()}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {sending ? (
                  <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" />Sending...</>
                ) : (
                  <><Send className="mr-1.5 h-3 w-3" />Send Reply</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Inbox View ──────────────────────────────────────────────────────────────

function InboxView({ workspaceEmail }: { workspaceEmail?: string | null }) {
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Thread | null>(null)
  const [mobileViewThread, setMobileViewThread] = useState(false)
  const isFirstLoad = useRef(true)

  const loadInbox = useCallback(async () => {
    const firstLoad = isFirstLoad.current
    if (firstLoad) setLoading(true)
    try {
      const res = await fetch("/api/email/inbox")
      if (res.ok) {
        const data = await res.json()
        const incomingThreads: Thread[] = data.threads || []
        setThreads(incomingThreads)
        // Keep selected thread in sync (update metadata but don't change selection)
        setSelected(prev => {
          if (!prev) return prev
          const updated = incomingThreads.find(t => t.threadId === prev.threadId)
          return updated || prev
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
    const interval = setInterval(loadInbox, 30000)
    return () => clearInterval(interval)
  }, [loadInbox])

  const handleSelect = (thread: Thread) => {
    setSelected(thread)
    setMobileViewThread(true)
    // Mark as read locally
    if (thread.hasUnread) {
      setThreads(prev => prev.map(t =>
        t.threadId === thread.threadId ? { ...t, hasUnread: false, unreadCount: 0 } : t
      ))
    }
  }

  const handleDeleted = (threadId: string) => {
    setThreads(prev => prev.filter(t => t.threadId !== threadId))
    setSelected(null)
    setMobileViewThread(false)
  }

  if (loading) {
    return (
      <div className="flex h-full gap-0">
        <div className="w-full md:w-80 lg:w-96 border-r border-border">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="border-b border-border p-4">
              <div className="flex justify-between mb-2">
                <Skeleton className="h-3.5 w-1/2" />
                <Skeleton className="h-3 w-10" />
              </div>
              <Skeleton className="h-3 w-3/4 mb-1" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (threads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
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
    <div className="flex h-full min-h-0">
      {/* Thread list */}
      <div className={cn(
        "flex-col border-r border-border overflow-y-auto",
        "w-full md:flex md:w-80 lg:w-96 shrink-0",
        mobileViewThread ? "hidden md:flex" : "flex"
      )}>
        {threads.map((thread) => (
          <button
            key={thread.threadId}
            onClick={() => handleSelect(thread)}
            className={cn(
              "w-full text-left border-b border-border px-4 py-3 transition-colors hover:bg-muted/50",
              selected?.threadId === thread.threadId && "bg-primary/5 border-l-2 border-l-primary",
              thread.hasUnread && "bg-blue-50/60"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {thread.hasUnread && (
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                )}
                <span className={cn(
                  "truncate text-sm",
                  thread.hasUnread ? "font-bold text-foreground" : "font-medium text-foreground"
                )}>
                  {thread.latestFrom}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {thread.messageCount > 1 && (
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {thread.messageCount}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">{formatDate(thread.latestAt)}</span>
              </div>
            </div>
            <p className={cn(
              "mt-0.5 truncate text-xs",
              thread.hasUnread ? "font-semibold text-foreground" : "text-muted-foreground"
            )}>
              {thread.subject}
            </p>
            {thread.snippet && (
              <p className="mt-1 line-clamp-1 text-xs text-muted-foreground/80">{thread.snippet}</p>
            )}
          </button>
        ))}
      </div>

      {/* Conversation pane */}
      <div className={cn(
        "flex-1 overflow-hidden",
        mobileViewThread ? "flex flex-col" : "hidden md:flex md:flex-col"
      )}>
        {selected ? (
          <ConversationPane
            thread={selected}
            workspaceEmail={workspaceEmail}
            onClose={() => setMobileViewThread(false)}
            onDeleted={handleDeleted}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            <div className="flex flex-col items-center gap-3">
              <MessageSquare className="h-10 w-10 text-muted-foreground/30" />
              <p>Select a conversation</p>
            </div>
          </div>
        )}
      </div>
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
  const [mobileViewEmail, setMobileViewEmail] = useState(false)
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
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (showReply) replyTextareaRef.current?.focus()
  }, [showReply])

  const toggle = (setter: React.Dispatch<React.SetStateAction<Record<string, boolean>>>, key: string) => {
    setter((prev) => ({ ...prev, [key]: !prev[key] }))
  }

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
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full gap-0">
        <div className="w-full md:w-64 lg:w-72 border-r border-border p-4">
          <Skeleton className="h-4 w-1/2 mb-3" />
          <Skeleton className="h-3 w-2/3 mb-2 ml-4" />
          <Skeleton className="h-3 w-1/2 mb-2 ml-8" />
        </div>
      </div>
    )
  }

  if (divisions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <FolderOpen className="h-8 w-8 text-muted-foreground/40" />
        </div>
        <p className="mt-4 text-sm font-medium text-muted-foreground">
          No filed emails yet. Use FILE in your inbox to organize responses.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Folder tree */}
      <div className={cn(
        "flex-col border-r border-border overflow-y-auto",
        "w-full md:flex md:w-64 lg:w-72 shrink-0",
        mobileViewEmail ? "hidden md:flex" : "flex"
      )}>
        <div className="p-3">
          {divisions.map((div) => {
            const divKey = div.division
            const divOpen = expandedDivisions[divKey] !== false
            return (
              <div key={divKey} className="mb-1">
                <button
                  onClick={() => toggle(setExpandedDivisions, divKey)}
                  className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs font-bold uppercase tracking-wider text-primary hover:bg-primary/5"
                >
                  {divOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                  <Folder className="h-3.5 w-3.5 shrink-0" />
                  {div.division}
                </button>
                {divOpen && div.conferences.map((conf) => {
                  const confKey = `${divKey}-${conf.conference}`
                  const confOpen = expandedConferences[confKey] !== false
                  return (
                    <div key={confKey} className="ml-4">
                      <button
                        onClick={() => toggle(setExpandedConferences, confKey)}
                        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs font-semibold text-foreground hover:bg-muted/50"
                      >
                        {confOpen ? <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />}
                        <FolderOpen className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className="truncate">{conf.conference}</span>
                      </button>
                      {confOpen && conf.schools.map((school) => {
                        const schoolKey = `${confKey}-${school.program_id || school.school_name}`
                        const schoolOpen = expandedSchools[schoolKey]
                        return (
                          <div key={schoolKey} className="ml-4">
                            <button
                              onClick={() => toggle(setExpandedSchools, schoolKey)}
                              className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs text-foreground hover:bg-muted/50"
                            >
                              {schoolOpen ? <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />}
                              <Building2 className="h-3 w-3 shrink-0 text-muted-foreground" />
                              <span className="truncate">{school.school_name}</span>
                            </button>
                            {schoolOpen && school.coaches.map((coach) => {
                              const coachKey = `${schoolKey}-${coach.coach_id || coach.coach_name}`
                              const coachOpen = expandedCoaches[coachKey]
                              return (
                                <div key={coachKey} className="ml-4">
                                  <button
                                    onClick={() => toggle(setExpandedCoaches, coachKey)}
                                    className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs text-muted-foreground hover:bg-muted/50"
                                  >
                                    {coachOpen ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                                    <User className="h-3 w-3 shrink-0" />
                                    <span className="truncate flex-1">{coach.coach_name}</span>
                                    <span className="ml-auto shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                                      {coach.emails.length}
                                    </span>
                                  </button>
                                  {coachOpen && coach.emails.map((email) => (
                                    <button
                                      key={email.id}
                                      onClick={() => { setSelected(email); setMobileViewEmail(true); setShowReply(false); setSent(false) }}
                                      className={cn(
                                        "ml-4 flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs text-muted-foreground hover:bg-muted/50",
                                        selected?.id === email.id && "bg-primary/5 text-primary font-medium"
                                      )}
                                    >
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
      <div className={cn(
        "flex-1 overflow-hidden flex-col",
        mobileViewEmail ? "flex" : "hidden md:flex"
      )}>
        {selected ? (
          <div className="flex h-full flex-col">
            <div className="flex items-start justify-between border-b border-border p-4 shrink-0">
              <div className="flex-1 min-w-0">
                {mobileViewEmail && (
                  <button
                    onClick={() => setMobileViewEmail(false)}
                    className="mb-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground md:hidden"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back
                  </button>
                )}
                <h2 className="text-base font-semibold text-foreground truncate">{selected.subject}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  From <span className="font-medium text-foreground">{selected.coach_name || selected.from_name || selected.from_email}</span>
                </p>
                {selected.received_at && (
                  <p className="text-xs text-muted-foreground mt-0.5">{new Date(selected.received_at).toLocaleString()}</p>
                )}
              </div>
              {selected.from_email && (
                <Button
                  size="sm"
                  onClick={() => setShowReply(!showReply)}
                  className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-xs ml-3"
                >
                  <Reply className="h-3 w-3" />
                  Reply
                </Button>
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
            </div>
            {showReply && (
              <div className="border-t border-border p-4 shrink-0">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Reply to {selected.coach_name || selected.from_name || selected.from_email}
                </p>
                <textarea
                  ref={replyTextareaRef}
                  className="w-full rounded-md border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  rows={4}
                  placeholder="Type your reply..."
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                />
                <div className="mt-2 flex items-center justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setShowReply(false); setReplyBody("") }}>Cancel</Button>
                  <Button
                    size="sm"
                    onClick={handleReply}
                    disabled={sending || !replyBody.trim()}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {sending ? <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" />Sending...</> : <><Send className="mr-1.5 h-3 w-3" />Send Reply</>}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            <div className="flex flex-col items-center gap-3">
              <FolderOpen className="h-10 w-10 text-muted-foreground/30" />
              <p>Select an email to read</p>
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
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  const tabs: { id: Tab; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: "inbox", label: "Inbox", icon: Inbox, badge: unreadCount },
    { id: "folders", label: "Folders", icon: FolderOpen },
  ]

  return (
    <div className="flex flex-col gap-0 -mx-4 -my-6 lg:-mx-8 lg:-my-8 h-[calc(100vh-5rem)]">
      {/* Page header */}
      <div className="border-b border-border bg-card px-4 pb-4 pt-6 lg:px-8 lg:pt-8 shrink-0">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-foreground sm:text-3xl">
              Email
            </h1>
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

      {/* Layout: sidebar tabs + content */}
      <div className="flex flex-1 min-h-0">
        {/* Left sidebar */}
        <nav className="flex w-[72px] flex-col border-r border-border bg-card py-2 md:w-44 shrink-0">
          {tabs.map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "relative flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors md:px-4",
                tab === id
                  ? "bg-primary/10 text-primary font-semibold border-l-2 border-primary"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
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

        {/* Content area */}
        <div className="flex-1 min-w-0 bg-background overflow-hidden">
          {tab === "inbox" && <InboxView workspaceEmail={recruitingEmail} />}
          {tab === "folders" && <FoldersView />}
        </div>
      </div>
    </div>
  )
}
