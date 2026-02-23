"use client"

import { useState, useEffect } from "react"
import {
  X,
  Users,
  MailOpen,
  Reply,
  Loader2,
  Pause,
  Play,
  CheckCircle2,
  Mail,
  ChevronRight,
  MousePointerClick,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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

function ProgramLogo({ logoUrl, schoolName }: { logoUrl: string | null; schoolName: string }) {
  const [hasError, setHasError] = useState(false)
  const initials = schoolName.slice(0, 2).toUpperCase()

  if (!logoUrl || hasError) {
    return (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[10px] font-bold text-primary ring-1 ring-primary/20">
        {initials}
      </div>
    )
  }

  return (
    <img
      src={logoUrl}
      alt={schoolName}
      className="h-8 w-8 shrink-0 rounded-lg object-contain ring-1 ring-primary/20"
      onError={() => setHasError(true)}
    />
  )
}

export function CampaignDetailsOverlay({ campaignId, onClose, onStatusChange }: CampaignDetailsProps) {
  const [campaign, setCampaign] = useState<CampaignDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [expandedProgram, setExpandedProgram] = useState<string | null>(null)
  const [selectedCoachData, setSelectedCoachData] = useState<{
    coach: any
    program: any
  } | null>(null)
  const [loadingCoach, setLoadingCoach] = useState<string | null>(null)

  useEffect(() => {
    fetchCampaignDetails()
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

  const handleCoachClick = async (coachId: string | null) => {
    if (!coachId) return
    setLoadingCoach(coachId)

    try {
      const supabase = createClient()

      const { data: coach } = await supabase
        .from('coaches')
        .select('*')
        .eq('id', coachId)
        .single()

      if (coach) {
        const { data: program } = await supabase
          .from('programs')
          .select('id, school_name, division, conference')
          .eq('id', coach.program_id)
          .single()

        if (program) {
          setSelectedCoachData({ coach, program })
        }
      }
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
      <div className="animate-in slide-in-from-right-8 fade-in fixed inset-0 z-50 overflow-y-auto duration-200">
        {/* Dimmed backdrop */}
        <div
          className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
          onClick={onClose}
          role="button"
          tabIndex={0}
          aria-label="Close campaign details"
        />

        {/* Slide-in panel */}
        <div className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col bg-card shadow-2xl sm:rounded-l-2xl">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : campaign ? (
            <>
              {/* Header */}
              <div className="flex items-center gap-3 border-b border-border px-5 py-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate font-display text-lg font-bold uppercase tracking-tight text-foreground">
                      {campaign.name}
                    </h2>
                    <Badge className={`${statusColors[campaign.status] || statusColors.draft} shrink-0 border-0 text-[10px] font-semibold`}>
                      {campaign.status}
                    </Badge>
                  </div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {goalLabels[campaign.goal] || campaign.goal} · {new Date(campaign.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-5">
                <div className="flex flex-col gap-5">
                  {/* Stats Row */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      { label: "Recipients", value: campaign.stats.total, icon: Users },
                      { label: "Open %", value: `${openRate}%`, icon: MailOpen },
                      { label: "Clicks", value: campaign.stats.clicked, icon: MousePointerClick },
                      { label: "Replies", value: campaign.stats.replied, icon: Reply },
                    ].map((stat) => (
                      <div key={stat.label} className="flex items-center gap-3 rounded-lg border border-border/50 p-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <stat.icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-lg font-bold text-foreground">{stat.value}</p>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{stat.label}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Email Sequence */}
                  {campaign.emails.length > 0 && (
                    <div>
                      <h3 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                        <div className="h-px flex-1 bg-border" />
                        Email Sequence
                        <div className="h-px flex-1 bg-border" />
                      </h3>
                      <div className="flex flex-col gap-2">
                        {campaign.emails.map((email) => (
                          <div key={email.id} className="flex items-center gap-3 rounded-lg border border-border/50 p-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                              {email.step_number}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-foreground">{email.subject}</p>
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                {email.send_after_days === 0
                                  ? 'Send immediately'
                                  : `Send after ${email.send_after_days} day${email.send_after_days > 1 ? 's' : ''}`}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Campaign Results */}
                  {campaign.programsWithRecipients && campaign.programsWithRecipients.length > 0 && (
                    <div>
                      <h3 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                        <div className="h-px flex-1 bg-border" />
                        Campaign Results
                        <div className="h-px flex-1 bg-border" />
                      </h3>
                      <div className="overflow-hidden rounded-lg border border-border">
                        {campaign.programsWithRecipients.map((program, index) => {
                          const pStats = getProgramStats(program.coaches)
                          const isExpanded = expandedProgram === program.program_name

                          return (
                            <div key={program.program_name} className={index > 0 ? 'border-t border-border' : ''}>
                              {/* Program row */}
                              <button
                                onClick={() => handleProgramToggle(program.program_name)}
                                className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-secondary/50"
                              >
                                <ProgramLogo logoUrl={program.logo_url} schoolName={program.program_name} />
                                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                                  {program.program_name}
                                </span>

                                {/* Rolled-up stats */}
                                <div className="hidden shrink-0 items-center gap-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:flex">
                                  <span>{pStats.total} rec</span>
                                  <span>{pStats.openRate}% open</span>
                                  <span>{pStats.clicked} click{pStats.clicked !== 1 ? 's' : ''}</span>
                                  <span>{pStats.replied} repl{pStats.replied !== 1 ? 'ies' : 'y'}</span>
                                </div>

                                <ChevronRight className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                              </button>

                              {/* Expanded coach rows */}
                              {isExpanded && (
                                <div className="border-t border-border bg-secondary/30">
                                  {/* Column headers */}
                                  <div className="grid grid-cols-[1fr_60px_60px_60px] items-center gap-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground sm:grid-cols-[1fr_80px_80px_80px]">
                                    <span>Coach</span>
                                    <span className="text-center">Opened</span>
                                    <span className="text-center">Clicked</span>
                                    <span className="text-center">Replied</span>
                                  </div>

                                  {program.coaches.map((coach) => (
                                    <div
                                      key={coach.id}
                                      className="grid grid-cols-[1fr_60px_60px_60px] items-center gap-2 border-t border-border/50 px-3 py-2 sm:grid-cols-[1fr_80px_80px_80px]"
                                    >
                                      <button
                                        onClick={() => handleCoachClick(coach.coach_id)}
                                        disabled={!coach.coach_id || loadingCoach === coach.coach_id}
                                        className="min-w-0 text-left"
                                      >
                                        <span className={`truncate text-sm font-medium ${coach.coach_id ? 'text-foreground transition-colors hover:text-primary hover:underline' : 'text-foreground'}`}>
                                          {loadingCoach === coach.coach_id ? (
                                            <span className="flex items-center gap-1.5">
                                              <Loader2 className="h-3 w-3 animate-spin" />
                                              {coach.coach_name}
                                            </span>
                                          ) : (
                                            coach.coach_name
                                          )}
                                        </span>
                                      </button>
                                      <div className="flex justify-center">
                                        {coach.opened_at && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                                      </div>
                                      <div className="flex justify-center">
                                        {coach.clicked_at && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                                      </div>
                                      <div className="flex justify-center">
                                        {coach.replied_at && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-border px-5 py-4">
                <div>
                  {(campaign.status === 'active' || campaign.status === 'paused') && (
                    <Button
                      onClick={handleToggleStatus}
                      disabled={toggling}
                      variant="outline"
                    >
                      {toggling ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : campaign.status === 'active' ? (
                        <>
                          <Pause className="h-4 w-4" />
                          Pause Campaign
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4" />
                          Resume Campaign
                        </>
                      )}
                    </Button>
                  )}
                </div>
                <Button variant="ghost" onClick={onClose}>
                  Close
                </Button>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center">
              <p className="text-muted-foreground">Failed to load campaign details</p>
            </div>
          )}
        </div>
      </div>

      {/* Coach Detail — layers on top at z-[70] */}
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
