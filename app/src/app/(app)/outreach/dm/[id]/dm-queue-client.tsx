"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  MessageCircle,
  Copy,
  ExternalLink,
  Check,
  CheckCircle2,
  Clock,
  Users,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { resolveMergeTags } from "@/lib/merge-tags"
import { formatGPA } from "@/lib/utils"
import { programPath } from "@/lib/program-utils"

interface Recipient {
  id: string
  coach_id: string | null
  coach_name: string
  coach_email: string
  program_name: string
  twitter_handle: string | null
  status: string
  dm_sent_at: string | null
}

interface Profile {
  first_name: string | null
  last_name: string | null
  position: string | null
  grad_year: number | null
  hudl_url: string | null
  high_school: string | null
  city: string | null
  state: string | null
  gpa: string | null
  phone: string | null
  email: string | null
}

interface Campaign {
  id: string
  name: string
  goal: string
  dm_message_body: string
  status: string
}

type FilterTab = "all" | "pending" | "sent"

interface DmQueueClientProps {
  campaign: Campaign
  recipients: Recipient[]
  profile: Profile | null
}

export function DmQueueClient({
  campaign,
  recipients: initialRecipients,
  profile,
}: DmQueueClientProps) {
  const [recipients, setRecipients] = useState(initialRecipients)
  const [filter, setFilter] = useState<FilterTab>("all")
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [markingId, setMarkingId] = useState<string | null>(null)

  const stats = useMemo(() => {
    const total = recipients.length
    const sent = recipients.filter((r) => r.dm_sent_at !== null).length
    return { total, sent, pending: total - sent }
  }, [recipients])

  const filteredRecipients = useMemo(() => {
    if (filter === "pending") return recipients.filter((r) => !r.dm_sent_at)
    if (filter === "sent") return recipients.filter((r) => r.dm_sent_at)
    return recipients
  }, [recipients, filter])

  const resolveMessage = (recipient: Recipient) => {
    return resolveMergeTags(campaign.dm_message_body || "", {
      coachName: recipient.coach_name,
      schoolName: recipient.program_name,
      playerFirstName: profile?.first_name || "",
      playerLastName: profile?.last_name || "",
      position: profile?.position || "",
      filmLink: profile?.hudl_url || "",
      gradYear: profile?.grad_year?.toString() || "",
      highSchool: profile?.high_school || "",
      city: profile?.city || "",
      state: profile?.state || "",
      gpa: formatGPA(profile?.gpa),
      phone: profile?.phone || "",
      email: profile?.email || "",
    })
  }

  const handleCopy = async (recipient: Recipient) => {
    const message = resolveMessage(recipient)
    try {
      await navigator.clipboard.writeText(message)
      setCopiedId(recipient.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea")
      textarea.value = message
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand("copy")
      document.body.removeChild(textarea)
      setCopiedId(recipient.id)
      setTimeout(() => setCopiedId(null), 2000)
    }
  }

  const handleOpenX = (handle: string) => {
    window.open(`https://x.com/${handle}`, "_blank")
  }

  const handleMarkSent = async (recipientId: string, sent: boolean) => {
    setMarkingId(recipientId)
    try {
      const res = await fetch(`/api/dm-campaigns/${campaign.id}/mark-sent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId, sent }),
      })

      if (res.ok) {
        setRecipients((prev) =>
          prev.map((r) =>
            r.id === recipientId
              ? {
                  ...r,
                  dm_sent_at: sent ? new Date().toISOString() : null,
                  status: sent ? "sent" : "pending",
                }
              : r
          )
        )
      }
    } catch (error) {
      console.error("Failed to mark sent:", error)
    } finally {
      setMarkingId(null)
    }
  }

  const progressPercent =
    stats.total > 0 ? Math.round((stats.sent / stats.total) * 100) : 0

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link
          href={programPath("/outreach")}
          className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold uppercase tracking-tight text-foreground sm:text-2xl">
                {campaign.name}
              </h1>
              <p className="text-sm text-muted-foreground">DM Queue</p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="font-bold text-foreground">{stats.total}</span>
              <span className="text-muted-foreground">total</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="font-bold text-green-600">{stats.sent}</span>
              <span className="text-muted-foreground">sent</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-bold text-foreground">{stats.pending}</span>
              <span className="text-muted-foreground">pending</span>
            </div>
          </div>
          <span className="text-sm font-bold text-primary">
            {progressPercent}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </Card>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(["all", "pending", "sent"] as FilterTab[]).map((tab) => {
          const count =
            tab === "all"
              ? stats.total
              : tab === "sent"
                ? stats.sent
                : stats.pending
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                filter === tab
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab} ({count})
            </button>
          )
        })}
      </div>

      {/* Coach Cards */}
      <div className="flex flex-col gap-3">
        {filteredRecipients.map((recipient) => {
          const isSent = !!recipient.dm_sent_at
          const message = resolveMessage(recipient)
          const isCopied = copiedId === recipient.id
          const isMarking = markingId === recipient.id

          return (
            <Card
              key={recipient.id}
              className={`overflow-hidden transition-all ${
                isSent ? "border-green-200 bg-green-50/30" : ""
              }`}
            >
              <div className="p-4">
                {/* Coach Info Row */}
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                      {recipient.coach_name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {recipient.coach_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {recipient.program_name}
                      </p>
                      {recipient.twitter_handle && (
                        <p className="text-xs text-primary">
                          @{recipient.twitter_handle}
                        </p>
                      )}
                    </div>
                  </div>
                  {isSent && (
                    <Badge className="border-0 bg-green-100 text-green-700">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Sent
                    </Badge>
                  )}
                </div>

                {/* Message Preview */}
                <div className="mb-3 rounded-lg border border-border bg-secondary/30 p-3">
                  <p className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">
                    {message}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopy(recipient)}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                      isCopied
                        ? "bg-green-100 text-green-700"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    }`}
                  >
                    {isCopied ? (
                      <>
                        <Check className="h-3 w-3" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        Copy Message
                      </>
                    )}
                  </button>

                  {recipient.twitter_handle && (
                    <button
                      type="button"
                      onClick={() => handleOpenX(recipient.twitter_handle!)}
                      className="flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-secondary/80"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Open in X
                    </button>
                  )}

                  <label className="ml-auto flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isSent}
                      disabled={isMarking}
                      onChange={() => handleMarkSent(recipient.id, !isSent)}
                      className="h-4 w-4 rounded border-border text-primary accent-primary"
                    />
                    <span className="text-xs font-medium text-muted-foreground">
                      {isMarking ? "Saving..." : "Mark Sent"}
                    </span>
                  </label>
                </div>
              </div>
            </Card>
          )
        })}

        {filteredRecipients.length === 0 && (
          <Card className="flex flex-col items-center justify-center p-12 text-center">
            <CheckCircle2 className="mb-3 h-10 w-10 text-green-500/30" />
            <p className="text-sm font-semibold text-foreground">
              {filter === "sent"
                ? "No DMs sent yet"
                : filter === "pending"
                  ? "All DMs sent!"
                  : "No recipients"}
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}
