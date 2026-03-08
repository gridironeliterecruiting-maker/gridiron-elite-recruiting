"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Inbox,
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
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ───────────────────────────────────────────────────────────────────

interface InboxItem {
  id: string
  campaign_id: string
  coach_id: string | null
  coach_name: string
  coach_email: string | null
  program_name: string
  replied_at: string | null
  is_read: boolean
  subject: string
  snippet: string
  program: {
    id: string
    school_name: string
    division: string
    conference: string
  } | null
}

interface FolderEmail {
  id: string
  campaign_id: string
  coach_name: string
  coach_email: string | null
  program_name: string
  replied_at: string | null
  filed_at: string
  subject: string
  snippet: string
}

interface CoachFolder {
  coach_id: string | null
  coach_name: string
  emails: FolderEmail[]
}

interface SchoolFolder {
  program_id: string
  school_name: string
  division: string
  conference: string
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
  if (diffDays === 0) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }
  if (diffDays < 7) {
    return d.toLocaleDateString([], { weekday: "short" })
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" })
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Inbox className="h-8 w-8 text-muted-foreground/40" />
      </div>
      <p className="mt-4 text-sm font-medium text-muted-foreground">{message}</p>
    </div>
  )
}

// ─── Reading Pane ─────────────────────────────────────────────────────────────

interface ReadingPaneProps {
  item: InboxItem | FolderEmail
  onClose?: () => void
  onFiled?: (id: string) => void
  showFileButton?: boolean
}

function ReadingPane({ item, onClose, onFiled, showFileButton = true }: ReadingPaneProps) {
  const [showReply, setShowReply] = useState(false)
  const [replyBody, setReplyBody] = useState("")
  const [sending, setSending] = useState(false)
  const [filing, setFiling] = useState(false)
  const [sent, setSent] = useState(false)

  const handleReply = async () => {
    if (!replyBody.trim()) return
    setSending(true)
    try {
      const res = await fetch("/api/email/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId: item.id, replyBody }),
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

  const handleFile = async () => {
    setFiling(true)
    try {
      const res = await fetch("/api/email/file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId: item.id }),
      })
      if (res.ok) {
        onFiled?.(item.id)
      } else {
        alert("Failed to file email")
      }
    } catch {
      alert("Network error. Please try again.")
    } finally {
      setFiling(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-border p-4">
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
          <h2 className="text-base font-semibold text-foreground truncate">{item.subject}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            From <span className="font-medium text-foreground">{item.coach_name}</span>
            {item.program_name && <> · {item.program_name}</>}
          </p>
          {item.replied_at && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(item.replied_at).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 ml-3">
          {showFileButton && onFiled && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleFile}
              disabled={filing}
              className="gap-1.5 text-xs"
            >
              {filing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Archive className="h-3 w-3" />}
              FILE
            </Button>
          )}
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

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4">
        {item.snippet ? (
          <div className="prose prose-sm max-w-none text-foreground">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{item.snippet}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            No message preview available. Check your Gmail for the full reply.
          </p>
        )}

        {sent && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            Reply sent successfully.
          </div>
        )}
      </div>

      {/* Reply composer */}
      {showReply && (
        <div className="border-t border-border p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Reply to {item.coach_name}
          </p>
          <textarea
            className="w-full rounded-md border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            rows={5}
            placeholder="Type your reply..."
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowReply(false)}>
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
      )}
    </div>
  )
}

// ─── Inbox View ──────────────────────────────────────────────────────────────

function InboxView() {
  const [items, setItems] = useState<InboxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<InboxItem | null>(null)
  const [mobileViewEmail, setMobileViewEmail] = useState(false)

  const loadInbox = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/email/inbox")
      if (res.ok) {
        const data = await res.json()
        setItems(data.items || [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadInbox()
  }, [loadInbox])

  const handleSelect = async (item: InboxItem) => {
    setSelected(item)
    setMobileViewEmail(true)
    if (!item.is_read) {
      // Mark as read optimistically
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, is_read: true } : i))
      )
      await fetch(`/api/email/inbox/${item.id}/read`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_read: true }),
      })
    }
  }

  const handleFiled = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
    setSelected(null)
    setMobileViewEmail(false)
  }

  if (loading) {
    return (
      <div className="flex h-full gap-0">
        <div className="w-full md:w-80 lg:w-96 border-r border-border">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="border-b border-border p-4">
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-3 w-1/2 mb-1" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <EmptyState message="Your inbox is empty — coaches will reply here when they respond to your campaigns." />
    )
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Email list */}
      <div
        className={cn(
          "flex-col border-r border-border overflow-y-auto",
          "w-full md:flex md:w-80 lg:w-96 shrink-0",
          mobileViewEmail ? "hidden md:flex" : "flex"
        )}
      >
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => handleSelect(item)}
            className={cn(
              "w-full text-left border-b border-border px-4 py-3 transition-colors hover:bg-muted/50",
              selected?.id === item.id && "bg-primary/5 border-l-2 border-l-primary",
              !item.is_read && "bg-blue-50/60"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {!item.is_read && (
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" aria-label="Unread" />
                )}
                <span
                  className={cn(
                    "truncate text-sm",
                    !item.is_read ? "font-bold text-foreground" : "font-medium text-foreground"
                  )}
                >
                  {item.coach_name}
                </span>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatDate(item.replied_at)}
              </span>
            </div>
            <p
              className={cn(
                "mt-0.5 truncate text-xs",
                !item.is_read ? "font-semibold text-foreground" : "text-muted-foreground"
              )}
            >
              {item.subject}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {item.program_name} {item.program?.division ? `· ${item.program.division}` : ""}
            </p>
            {item.snippet && (
              <p className="mt-1 line-clamp-1 text-xs text-muted-foreground/80">{item.snippet}</p>
            )}
          </button>
        ))}
      </div>

      {/* Reading pane */}
      <div
        className={cn(
          "flex-1 overflow-hidden",
          mobileViewEmail ? "flex flex-col" : "hidden md:flex md:flex-col"
        )}
      >
        {selected ? (
          <ReadingPane
            item={selected}
            onClose={() => setMobileViewEmail(false)}
            onFiled={handleFiled}
            showFileButton
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            <div className="flex flex-col items-center gap-3">
              <MailOpen className="h-10 w-10 text-muted-foreground/30" />
              <p>Select an email to read</p>
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

  const toggle = (
    setter: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
    key: string
  ) => {
    setter((prev) => ({ ...prev, [key]: !prev[key] }))
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
      <EmptyState message="No filed emails yet. Use the FILE button in your inbox to organize coach replies." />
    )
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Folder tree */}
      <div
        className={cn(
          "flex-col border-r border-border overflow-y-auto",
          "w-full md:flex md:w-64 lg:w-72 shrink-0",
          mobileViewEmail ? "hidden md:flex" : "flex"
        )}
      >
        <div className="p-3">
          {divisions.map((div) => {
            const divKey = div.division
            const divOpen = expandedDivisions[divKey] !== false // default open

            return (
              <div key={divKey} className="mb-1">
                <button
                  onClick={() => toggle(setExpandedDivisions, divKey)}
                  className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs font-bold uppercase tracking-wider text-primary hover:bg-primary/5"
                >
                  {divOpen ? (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                  )}
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
                        {confOpen ? (
                          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                        )}
                        <FolderOpen className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className="truncate">{conf.conference}</span>
                      </button>

                      {confOpen && conf.schools.map((school) => {
                        const schoolKey = `${confKey}-${school.program_id}`
                        const schoolOpen = expandedSchools[schoolKey]

                        return (
                          <div key={schoolKey} className="ml-4">
                            <button
                              onClick={() => toggle(setExpandedSchools, schoolKey)}
                              className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs text-foreground hover:bg-muted/50"
                            >
                              {schoolOpen ? (
                                <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                              )}
                              <Building2 className="h-3 w-3 shrink-0 text-muted-foreground" />
                              <span className="truncate">{school.school_name}</span>
                            </button>

                            {schoolOpen && school.coaches.map((coach) => {
                              const coachKey = `${schoolKey}-${coach.coach_id || coach.coach_name}`
                              const coachOpen = expandedCoaches[coachKey]
                              const emailCount = coach.emails.length

                              return (
                                <div key={coachKey} className="ml-4">
                                  <button
                                    onClick={() => toggle(setExpandedCoaches, coachKey)}
                                    className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs text-muted-foreground hover:bg-muted/50"
                                  >
                                    {coachOpen ? (
                                      <ChevronDown className="h-3 w-3 shrink-0" />
                                    ) : (
                                      <ChevronRight className="h-3 w-3 shrink-0" />
                                    )}
                                    <User className="h-3 w-3 shrink-0" />
                                    <span className="truncate flex-1">{coach.coach_name}</span>
                                    <span className="ml-auto shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                                      {emailCount}
                                    </span>
                                  </button>

                                  {coachOpen && coach.emails.map((email) => (
                                    <button
                                      key={email.id}
                                      onClick={() => {
                                        setSelected(email)
                                        setMobileViewEmail(true)
                                      }}
                                      className={cn(
                                        "ml-4 flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs text-muted-foreground hover:bg-muted/50",
                                        selected?.id === email.id && "bg-primary/5 text-primary font-medium"
                                      )}
                                    >
                                      <Mail className="h-3 w-3 shrink-0" />
                                      <span className="truncate flex-1">{email.subject}</span>
                                      <span className="shrink-0 text-[10px]">{formatDate(email.filed_at)}</span>
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
      <div
        className={cn(
          "flex-1 overflow-hidden",
          mobileViewEmail ? "flex flex-col" : "hidden md:flex md:flex-col"
        )}
      >
        {selected ? (
          <ReadingPane
            item={selected}
            onClose={() => setMobileViewEmail(false)}
            showFileButton={false}
          />
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

export function EmailClient() {
  const [tab, setTab] = useState<Tab>("inbox")
  const [unreadCount, setUnreadCount] = useState(0)

  // Load unread count for badge
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/email/inbox")
        if (res.ok) {
          const data = await res.json()
          setUnreadCount(data.unreadCount || 0)
        }
      } catch {
        // Ignore
      }
    }
    load()
  }, [])

  const tabs: { id: Tab; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: "inbox", label: "Inbox", icon: Inbox, badge: unreadCount },
    { id: "folders", label: "Folders", icon: FolderOpen },
  ]

  return (
    <div className="flex flex-col gap-0 -mx-4 -my-6 lg:-mx-8 lg:-my-8 h-[calc(100vh-5rem)]">
      {/* Page header */}
      <div className="border-b border-border bg-card px-4 py-4 lg:px-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-foreground">
              Email
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Coach replies and sent campaigns
            </p>
          </div>
        </div>
      </div>

      {/* Layout: sidebar tabs + content */}
      <div className="flex flex-1 min-h-0">
        {/* Left sidebar — vertical tabs */}
        <nav className="flex w-[72px] flex-col border-r border-border bg-card py-2 md:w-44 shrink-0">
          {tabs.map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "relative flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors",
                "md:px-4",
                tab === id
                  ? "bg-primary/10 text-primary font-semibold border-l-2 border-primary"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden md:inline">{label}</span>
              {badge !== undefined && badge > 0 && (
                <Badge
                  className="ml-auto hidden h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-accent p-0 text-[10px] font-bold text-white md:flex"
                >
                  {badge > 99 ? "99+" : badge}
                </Badge>
              )}
              {/* Mobile badge dot */}
              {badge !== undefined && badge > 0 && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-accent md:hidden" />
              )}
            </button>
          ))}
        </nav>

        {/* Content area */}
        <div className="flex-1 min-w-0 bg-background">
          {tab === "inbox" && <InboxView />}
          {tab === "folders" && <FoldersView />}
        </div>
      </div>
    </div>
  )
}
