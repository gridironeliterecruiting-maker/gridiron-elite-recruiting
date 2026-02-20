"use client"

import { useState, useEffect } from "react"
import { X, Send, Users, MailOpen, Reply, XCircle, Loader2, Pause, Play, CheckCircle2, Calendar, Mail, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

interface CampaignDetailsProps {
  campaignId: string
  onClose: () => void
  onStatusChange?: () => void
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
    replied: number
    error: number
  }
  emails: Array<{
    id: string
    step_number: number
    subject: string
    send_after_days: number
  }>
  programsWithRecipients: Array<{
    program_name: string
    coaches: Array<{
      id: string
      coach_name: string
      coach_email: string
      status: string
      sent_at: string | null
      opened_at: string | null
      replied_at: string | null
    }>
  }>
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

export function CampaignDetailsOverlay({ campaignId, onClose, onStatusChange }: CampaignDetailsProps) {
  const [campaign, setCampaign] = useState<CampaignDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)

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
      console.log('Campaign details received:', {
        id: data.id,
        name: data.name,
        programsWithRecipients: data.programsWithRecipients
      })
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative z-10 w-full max-w-3xl rounded-xl border bg-background shadow-2xl">
        {loading ? (
          <div className="flex h-96 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : campaign ? (
          <>
            {/* Header */}
            <div className="border-b px-6 py-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{campaign.name}</h2>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge className={`${statusColors[campaign.status] || statusColors.draft} border-0 text-xs`}>
                      {campaign.status}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {goalLabels[campaign.goal] || campaign.goal}
                    </span>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="max-h-[calc(100vh-12rem)] overflow-y-auto p-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <Card className="border-border/50">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-2xl font-semibold">{campaign.stats.total}</p>
                        <p className="text-xs text-muted-foreground">Recipients</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="border-border/50">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2">
                      <Send className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-2xl font-semibold">{campaign.stats.sent}</p>
                        <p className="text-xs text-muted-foreground">Sent</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/50">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2">
                      <MailOpen className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-2xl font-semibold">{campaign.stats.opened}</p>
                        <p className="text-xs text-muted-foreground">Opened</p>
                        {campaign.stats.sent > 0 && (
                          <p className="text-[10px] text-muted-foreground">
                            {Math.round((campaign.stats.opened / campaign.stats.sent) * 100)}%
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/50">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2">
                      <Reply className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-2xl font-semibold">{campaign.stats.replied}</p>
                        <p className="text-xs text-muted-foreground">Replied</p>
                        {campaign.stats.sent > 0 && (
                          <p className="text-[10px] text-muted-foreground">
                            {Math.round((campaign.stats.replied / campaign.stats.sent) * 100)}%
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {campaign.stats.error > 0 && (
                  <Card className="border-red-200 bg-red-50">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-500" />
                        <div>
                          <p className="text-2xl font-semibold text-red-700">{campaign.stats.error}</p>
                          <p className="text-xs text-red-600">Errors</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Campaign Info */}
              <div className="mt-6 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold">Campaign Details</h3>
                  <div className="mt-2 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Created</span>
                      <span>{new Date(campaign.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Email Steps */}
                {campaign.emails.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold">Email Sequence</h3>
                    <div className="mt-2 space-y-2">
                      {campaign.emails.map((email) => (
                        <div key={email.id} className="flex items-center gap-3 rounded-lg border border-border/50 p-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {email.step_number}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">{email.subject}</p>
                            <p className="text-xs text-muted-foreground">
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

                {/* Targeted Programs & Coaches */}
                {campaign.programsWithRecipients && campaign.programsWithRecipients.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold">Targeted Programs & Coaches</h3>
                    <div className="mt-2 space-y-2">
                      {campaign.programsWithRecipients.map((program, index) => (
                        <ProgramSection key={index} program={program} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
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
            </div>
          </>
        ) : (
          <div className="p-6 text-center">
            <p className="text-muted-foreground">Failed to load campaign details</p>
          </div>
        )}
      </div>
    </div>
  )
}

// Component for expandable program sections
function ProgramSection({ program }: { program: { program_name: string; coaches: Array<any> } }) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="rounded-lg border border-border/50 bg-secondary/30 p-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{program.program_name}</span>
          <Badge variant="secondary" className="text-xs">
            {program.coaches.length} Coaches
          </Badge>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      
      {isExpanded && (
        <div className="mt-3 space-y-2 border-t border-border/50 pt-3">
          {program.coaches.map((coach) => (
            <div key={coach.id} className="flex items-center justify-between rounded-md bg-background p-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{coach.coach_name}</p>
                <p className="text-xs text-muted-foreground">{coach.coach_email}</p>
              </div>
              <div className="flex items-center gap-2">
                {coach.sent_at && (
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Sent</span>
                  </div>
                )}
                {coach.opened_at && (
                  <div className="flex items-center gap-1">
                    <MailOpen className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs text-primary">Opened</span>
                  </div>
                )}
                {coach.replied_at && (
                  <div className="flex items-center gap-1">
                    <Reply className="h-3.5 w-3.5 text-accent" />
                    <span className="text-xs text-accent">Replied</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}