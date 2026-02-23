"use client"

import { useState, useEffect, useRef } from "react"
import {
  ArrowLeft,
  Users,
  MailOpen,
  Reply,
  Loader2,
  Pause,
  Play,
  CheckCircle2,
  Minus,
  ChevronRight,
  MousePointerClick,
  ExternalLink,
  Send,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { CoachDetail } from "@/components/programs/coach-detail"

interface CampaignDetailsProps {
  campaignId: string
  onClose: () => void
  onStatusChange?: () => void
}

interface CoachRecipient {
  id: string
  coach_id: string | null
  coach_name: string
  coach_email: string
  status: string
  sent_at: string | null
  opened_at: string | null
  clicked_at: string | null
  replied_at: string | null
}

interface ProgramGroup {
  program_name: string
  program_id: string | null
  logo_url: string | null
  coaches: CoachRecipient[]
}

interface CampaignDetails {
  id: string
  name: string
  goal: string
  status: string
  type?: string
  created_at: string
  stats: {
    total: number
    sent: number
    opened: number
    clicked: number
    replied: number
    error: number
  }
  emails: Array<{
    id: string
    step_number: number
    subject: string
    send_after_days: number
  }>
  programsWithRecipients: ProgramGroup[]
}

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

function ProgramLogo({ logoUrl, schoolName, size = 40 }: { logoUrl: string | null; schoolName: string; size?: number }) {
  const [hasError, setHasError] = useState(false)
  const initials = schoolName.slice(0, 3).toUpperCase()

  if (!logoUrl || hasError) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary ring-1 ring-primary/20"
        style={{ width: size, height: size }}
      >
        {initials}
      </div>
    )
  }

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-primary/20 overflow-hidden"
      style={{ width: size, height: size }}
    >
      <img
        src={logoUrl}
        alt={schoolName}
        width={size - 8}
        height={size - 8}
        className="object-contain"
        onError={() => setHasError(true)}
      />
    </div>
  )
}

export function CampaignDetailsOverlay({ campaignId, onClose, onStatusChange }: CampaignDetailsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [campaign, setCampaign] = useState<CampaignDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [expandedProgram, setExpandedProgram] = useState<string | null>(null)
  const [selectedCoachData, setSelectedCoachData] = useState<{
    coach: any
    program: any
  } | null>(null)
  const [loadingCoach, setLoadingCoach] = useState<string | null>(null)

  // Lock body scroll when overlay is open
  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [])

  useEffect(() => {
    fetchCampaignDetails()
  }, [campaignId])

  useEffect(() => {
    containerRef.current?.scrollTo(0, 0)
  }, [campaignId])

  const fetchCampaignDetails = async () => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/details`)
      if (!res.ok) {
        throw new Error('Failed to fetch campaign details')
      }
      const data = await res.json()
      setCampaign(data)
    } catch (err) {
      console.error('Error fetching campaign details:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleStatus = async () => {
    if (!campaign || toggling) return

    setToggling(true)
    const newStatus = campaign.status === 'active' ? 'paused' : 'active'

    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (res.ok) {
        setCampaign(prev => prev ? { ...prev, status: newStatus } : null)
        onStatusChange?.()
      }
    } catch (err) {
      console.error('Failed to toggle campaign status:', err)
    } finally {
      setToggling(false)
    }
  }

  const handleCoachClick = async (e: React.MouseEvent, coach: CoachRecipient, programName: string) => {
    e.stopPropagation()
    if (loadingCoach) return
    const loadingKey = coach.coach_id || coach.id
    setLoadingCoach(loadingKey)

    try {
      const supabase = createClient()

      let coachData: any = null

      // Try by coach_id first
      if (coach.coach_id) {
        const { data } = await supabase
          .from('coaches')
          .select('*')
          .eq('id', coach.coach_id)
          .single()
        coachData = data
      }

      // Fallback: look up by name + program
      if (!coachData && coach.coach_name) {
        const nameParts = coach.coach_name.trim().split(/\s+/)
        const firstName = nameParts[0]
        const lastName = nameParts.slice(1).join(' ')

        if (firstName && lastName) {
          const { data } = await supabase
            .from('coaches')
            .select('*, programs!inner(school_name)')
            .eq('first_name', firstName)
            .eq('last_name', lastName)
            .eq('programs.school_name', programName)
            .single()
          coachData = data
        }
      }

      if (!coachData) {
        console.error('Could not find coach')
        return
      }

      const { data: program } = await supabase
        .from('programs')
        .select('id, school_name, division, conference')
        .eq('id', coachData.program_id)
        .single()

      if (!program) {
        console.error('Could not find program')
        return
      }

      setSelectedCoachData({ coach: coachData, program })
    } catch (err) {
      console.error('Failed to fetch coach data:', err)
    } finally {
      setLoadingCoach(null)
    }
  }

  const handleProgramToggle = (programName: string) => {
    setExpandedProgram(prev => prev === programName ? null : programName)
  }

  // Calculate per-program rolled-up stats
  const getProgramStats = (coaches: CoachRecipient[]) => {
    const total = coaches.length
    const opened = coaches.filter(c => c.opened_at).length
    const clicked = coaches.filter(c => c.clicked_at).length
    const replied = coaches.filter(c => c.replied_at).length
    const openRate = total > 0 ? Math.round((opened / total) * 100) : 0
    return { total, opened, openRate, clicked, replied }
  }

  const openRate = campaign && campaign.stats.sent > 0
    ? Math.round((campaign.stats.opened / campaign.stats.sent) * 100)
    : 0

  return (
    <>
      {/* Full-screen overlay */}
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
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Send className="h-5 w-5" />
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
                      <span className="text-xs text-muted-foreground">
                        {goalLabels[campaign.goal] || campaign.goal}
                      </span>
                      <span className="text-xs text-muted-foreground/40">·</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(campaign.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                {(campaign.status === 'active' || campaign.status === 'paused') && (
                  <Button
                    onClick={handleToggleStatus}
                    disabled={toggling}
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                  >
                    {toggling ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : campaign.status === 'active' ? (
                      <>
                        <Pause className="h-3.5 w-3.5" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5" />
                        Resume
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
              <div className="flex flex-col gap-6">
                {/* Stats Row */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {[
                    { label: "Recipients", value: campaign.stats.total, icon: Users },
                    { label: "Open Rate", value: `${openRate}%`, icon: MailOpen },
                    { label: "Clicks", value: campaign.stats.clicked, icon: MousePointerClick },
                    { label: "Replies", value: campaign.stats.replied, icon: Reply },
                  ].map((stat) => (
                    <Card key={stat.label} className="flex items-center gap-3 p-4">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <stat.icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{stat.label}</p>
                        <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                      </div>
                    </Card>
                  ))}
                </div>

                {/* Email Sequence */}
                {campaign.emails.length > 0 && (
                  <div>
                    <h2 className="mb-4 font-display text-base font-bold uppercase tracking-wider text-foreground">
                      Email Sequence
                    </h2>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {campaign.emails.map((email) => (
                        <Card key={email.id} className="flex items-center gap-3 p-4">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                            {email.step_number}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground">{email.subject}</p>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                              {email.send_after_days === 0
                                ? 'Send immediately'
                                : `Send after ${email.send_after_days} day${email.send_after_days > 1 ? 's' : ''}`}
                            </p>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Campaign Results */}
                {campaign.programsWithRecipients && campaign.programsWithRecipients.length > 0 && (
                  <div>
                    <h2 className="mb-4 font-display text-base font-bold uppercase tracking-wider text-foreground">
                      Campaign Results
                    </h2>
                    <div className="flex flex-col gap-4">
                      {campaign.programsWithRecipients.map((program) => {
                        const pStats = getProgramStats(program.coaches)
                        const isExpanded = expandedProgram === program.program_name

                        return (
                          <div key={program.program_name}>
                            {/* Program row */}
                            <button
                              onClick={() => handleProgramToggle(program.program_name)}
                              className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-4 text-left transition-all hover:border-primary/30 hover:shadow-md"
                            >
                              <ProgramLogo logoUrl={program.logo_url} schoolName={program.program_name} />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-foreground">{program.program_name}</p>
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                  {pStats.total} recipient{pStats.total !== 1 ? 's' : ''}
                                </p>
                              </div>

                              {/* Rolled-up stats — evenly spaced */}
                              <div className="hidden shrink-0 sm:grid sm:grid-cols-3 sm:gap-8">
                                <div className="flex flex-col items-center">
                                  <p className="text-sm font-semibold text-foreground">{pStats.openRate}%</p>
                                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Open</p>
                                </div>
                                <div className="flex flex-col items-center">
                                  <p className="text-sm font-semibold text-foreground">{pStats.clicked}</p>
                                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Clicks</p>
                                </div>
                                <div className="flex flex-col items-center">
                                  <p className="text-sm font-semibold text-foreground">{pStats.replied}</p>
                                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Replies</p>
                                </div>
                              </div>

                              <ChevronRight className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                            </button>

                            {/* Expanded: spreadsheet-style coach table in one box */}
                            {isExpanded && (
                              <Card className="mt-2 overflow-hidden">
                                {/* Header row */}
                                <div className="grid grid-cols-[1fr_72px_72px_72px] items-center border-b border-border bg-secondary/50 px-4 py-2 sm:grid-cols-[1fr_88px_88px_88px]">
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Coach</span>
                                  <span className="text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Opened</span>
                                  <span className="text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Clicked</span>
                                  <span className="text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Replied</span>
                                </div>

                                {/* Coach rows */}
                                {program.coaches.map((coach, i) => {
                                  const loadingKey = coach.coach_id || coach.id
                                  const isLoading = loadingCoach === loadingKey
                                  return (
                                  <button
                                    key={coach.id}
                                    type="button"
                                    onClick={(e) => handleCoachClick(e, coach, program.program_name)}
                                    disabled={isLoading}
                                    className={`group grid w-full grid-cols-[1fr_72px_72px_72px] items-center px-4 py-3 text-left transition-colors hover:bg-primary/[0.03] sm:grid-cols-[1fr_88px_88px_88px] ${i > 0 ? 'border-t border-border/50' : ''}`}
                                  >
                                    {/* Coach name + ExternalLink on hover */}
                                    <div className="flex min-w-0 items-center gap-2">
                                      {isLoading ? (
                                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
                                      ) : null}
                                      <span className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                                        {coach.coach_name}
                                      </span>
                                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-primary" />
                                    </div>

                                    {/* Opened */}
                                    <div className="flex justify-center">
                                      {coach.opened_at
                                        ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                        : <Minus className="h-4 w-4 text-muted-foreground/30" />
                                      }
                                    </div>

                                    {/* Clicked */}
                                    <div className="flex justify-center">
                                      {coach.clicked_at
                                        ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                        : <Minus className="h-4 w-4 text-muted-foreground/30" />
                                      }
                                    </div>

                                    {/* Replied */}
                                    <div className="flex justify-center">
                                      {coach.replied_at
                                        ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                        : <Minus className="h-4 w-4 text-muted-foreground/30" />
                                      }
                                    </div>
                                  </button>
                                  )
                                })}
                              </Card>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center">
            <p className="text-muted-foreground">Failed to load campaign details</p>
          </div>
        )}
      </div>

      {/* Coach Detail right panel — layers on top at z-[70] */}
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
