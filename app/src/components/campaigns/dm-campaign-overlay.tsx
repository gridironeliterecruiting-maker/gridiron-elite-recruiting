"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import {
  ArrowLeft,
  MessageCircle,
  Copy,
  ExternalLink,
  Check,
  CheckCircle2,
  Clock,
  Users,
  Loader2,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { resolveMergeTags } from "@/lib/merge-tags"
import { CoachDetail } from "@/components/programs/coach-detail"

interface DmCampaignOverlayProps {
  campaignId: string
  onClose: () => void
  embedded?: boolean
}

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
  created_at: string
}

type FilterTab = "all" | "pending" | "sent"

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  active: "bg-emerald-100 text-emerald-700",
  paused: "bg-amber-100 text-amber-700",
  completed: "bg-blue-100 text-blue-700",
  cancelled: "bg-red-100 text-red-700",
}

const goalLabels: Record<string, string> = {
  get_response: "Get Response",
  evaluate_film: "Film Evaluation",
  build_interest: "Build Interest",
  secure_visit: "Secure Visit",
  other: "Other",
}

/** Look up a coach by ID or by name+program fallback */
async function fetchCoachAndProgram(
  coachId: string | null,
  coachName: string,
  programName: string,
): Promise<{ coach: any; program: any } | null> {
  const supabase = createClient()

  let coachData: any = null

  if (coachId) {
    const { data } = await supabase
      .from('coaches')
      .select('*')
      .eq('id', coachId)
      .single()
    coachData = data
  }

  if (!coachData && coachName) {
    const nameParts = coachName.trim().split(/\s+/)
    const firstName = nameParts[0]
    const lastName = nameParts.slice(1).join(' ')

    if (firstName && lastName) {
      const { data: prog } = await supabase
        .from('programs')
        .select('id')
        .eq('school_name', programName)
        .maybeSingle()

      if (prog) {
        const { data } = await supabase
          .from('coaches')
          .select('*')
          .eq('first_name', firstName)
          .eq('last_name', lastName)
          .eq('program_id', prog.id)
          .maybeSingle()
        coachData = data
      }
    }
  }

  if (!coachData) return null

  const { data: program } = await supabase
    .from('programs')
    .select('id, school_name, division, conference')
    .eq('id', coachData.program_id)
    .single()

  if (!program) return null
  return { coach: coachData, program }
}

export function DmCampaignOverlay({ campaignId, onClose, embedded = false }: DmCampaignOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [filter, setFilter] = useState<FilterTab>("all")
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [markingId, setMarkingId] = useState<string | null>(null)
  const [selectedCoachData, setSelectedCoachData] = useState<{ coach: any; program: any } | null>(null)
  const [loadingCoach, setLoadingCoach] = useState<string | null>(null)

  useEffect(() => {
    if (embedded) return
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [embedded])

  useEffect(() => { fetchData() }, [campaignId])
  useEffect(() => { containerRef.current?.scrollTo(0, 0) }, [campaignId])

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/dm-campaigns/${campaignId}/details`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setCampaign(data.campaign)
      setRecipients(data.recipients)
      setProfile(data.profile)
    } catch (err) {
      console.error('Error fetching DM campaign:', err)
    } finally {
      setLoading(false)
    }
  }

  const stats = useMemo(() => {
    const total = recipients.length
    const sent = recipients.filter(r => r.dm_sent_at !== null).length
    return { total, sent, pending: total - sent }
  }, [recipients])

  const filteredRecipients = useMemo(() => {
    if (filter === "pending") return recipients.filter(r => !r.dm_sent_at)
    if (filter === "sent") return recipients.filter(r => r.dm_sent_at)
    return recipients
  }, [recipients, filter])

  const resolveMessage = (recipient: Recipient) => {
    return resolveMergeTags(campaign?.dm_message_body || "", {
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
      gpa: profile?.gpa?.toString() || "",
      phone: profile?.phone || "",
      email: profile?.email || "",
    })
  }

  const handleCopy = async (recipient: Recipient) => {
    const message = resolveMessage(recipient)
    try {
      await navigator.clipboard.writeText(message)
    } catch {
      const textarea = document.createElement("textarea")
      textarea.value = message
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand("copy")
      document.body.removeChild(textarea)
    }
    setCopiedId(recipient.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleOpenX = (handle: string) => {
    window.open(`https://x.com/${handle}`, "_blank")
  }

  const handleMarkSent = async (recipientId: string, sent: boolean) => {
    setMarkingId(recipientId)
    try {
      const res = await fetch(`/api/dm-campaigns/${campaignId}/mark-sent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId, sent }),
      })
      if (res.ok) {
        setRecipients(prev =>
          prev.map(r =>
            r.id === recipientId
              ? { ...r, dm_sent_at: sent ? new Date().toISOString() : null, status: sent ? "sent" : "pending" }
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

  const handleCoachClick = async (e: React.MouseEvent, recipient: Recipient) => {
    e.stopPropagation()
    if (loadingCoach) return
    const key = recipient.coach_id || recipient.coach_name
    setLoadingCoach(key)
    try {
      const result = await fetchCoachAndProgram(recipient.coach_id, recipient.coach_name, recipient.program_name)
      if (result) setSelectedCoachData(result)
    } catch (err) {
      console.error('Failed to fetch coach data:', err)
    } finally {
      setLoadingCoach(null)
    }
  }

  const progressPercent = stats.total > 0 ? Math.round((stats.sent / stats.total) * 100) : 0

  // Shared queue content (used in both embedded and standalone modes)
  const queueContent = (
    <>
      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : campaign ? (
        <div className="flex flex-col gap-6">
          {/* Progress */}
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
              <span className="text-sm font-bold text-primary">{progressPercent}%</span>
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
              const count = tab === "all" ? stats.total : tab === "sent" ? stats.sent : stats.pending
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
              const coachKey = recipient.coach_id || recipient.coach_name
              const isLoadingCoach = loadingCoach === coachKey

              return (
                <Card
                  key={recipient.id}
                  className={`overflow-hidden transition-all ${isSent ? "border-green-200 bg-green-50/30" : ""}`}
                >
                  <div className="p-4">
                    {/* Coach Info Row — clickable */}
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={(e) => handleCoachClick(e, recipient)}
                        disabled={isLoadingCoach}
                        className="group flex items-center gap-3 text-left"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                          {recipient.coach_name
                            .split(" ")
                            .map(n => n[0])
                            .join("")
                            .slice(0, 2)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                              {isLoadingCoach ? (
                                <span className="flex items-center gap-1.5">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  {recipient.coach_name}
                                </span>
                              ) : (
                                recipient.coach_name
                              )}
                            </p>
                            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-primary" />
                          </div>
                          <p className="text-xs text-muted-foreground">{recipient.program_name}</p>
                          {recipient.twitter_handle && (
                            <p className="text-xs text-primary">@{recipient.twitter_handle}</p>
                          )}
                        </div>
                      </button>
                      {isSent && (
                        <Badge className="border-0 bg-green-100 text-green-700">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Sent
                        </Badge>
                      )}
                    </div>

                    {/* Message Preview */}
                    <div className="mb-3 rounded-lg border border-border bg-secondary/30 p-3">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
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
                          <><Check className="h-3 w-3" /> Copied!</>
                        ) : (
                          <><Copy className="h-3 w-3" /> Copy Message</>
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
                  {filter === "sent" ? "No DMs sent yet" : filter === "pending" ? "All DMs sent!" : "No recipients"}
                </p>
              </Card>
            )}
          </div>
        </div>
      ) : (
        <div className="flex min-h-[200px] items-center justify-center p-6 text-center">
          <p className="text-muted-foreground">Failed to load DM campaign</p>
        </div>
      )}
    </>
  )

  // Embedded mode: render queue content inline (parent overlay provides chrome)
  if (embedded) {
    return (
      <>
        {queueContent}
        {selectedCoachData && (
          <CoachDetail
            coach={selectedCoachData.coach}
            program={selectedCoachData.program}
            onClose={() => setSelectedCoachData(null)}
          />
        )}
      </>
    )
  }

  // Standalone mode: full-screen overlay with header
  return (
    <>
      <div
        ref={containerRef}
        className="animate-in slide-in-from-right-8 fade-in fixed inset-0 z-[60] overflow-y-auto bg-background duration-300"
      >
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : campaign ? (
          <>
            {/* Sticky header */}
            <div className="sticky top-0 z-10 border-b border-border bg-card shadow-sm">
              <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 lg:px-8">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                  aria-label="Go back"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>

                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="font-display text-lg font-bold uppercase tracking-tight text-foreground sm:text-xl">
                        {campaign.name}
                      </h1>
                      <Badge className={`${statusColors[campaign.status] || statusColors.draft} shrink-0 border-0 text-[9px] font-bold uppercase tracking-wider`}>
                        {campaign.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">DM Queue</span>
                      <span className="text-xs text-muted-foreground/40">·</span>
                      <span className="text-xs text-muted-foreground">
                        {goalLabels[campaign.goal] || campaign.goal}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
              {queueContent}
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center">
            <p className="text-muted-foreground">Failed to load DM campaign</p>
          </div>
        )}
      </div>

      {selectedCoachData && (
        <CoachDetail
          coach={selectedCoachData.coach}
          program={selectedCoachData.program}
          onClose={() => setSelectedCoachData(null)}
        />
      )}
    </>
  )
}
