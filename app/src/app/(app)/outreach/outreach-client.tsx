"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Mail,
  FileText,
  ChevronRight,
  Copy,
  Eye,
  Send,
  Inbox,
  Plus,
  CheckCircle2,
  AlertCircle,
  Play,
  Pause,
  Users,
  MailOpen,
  Reply,
  XCircle,
  Loader2,
} from "lucide-react"
import { CreateCampaignOverlay } from "@/components/campaigns/create-campaign-overlay"

interface EmailTemplate {
  id: string
  name: string
  subject: string
  category: string
  body?: string
}

interface Program {
  id: string
  school_name: string
  division: string
  conference: string
  logo_url: string | null
}

interface CampaignStats {
  total: number
  sent: number
  opened: number
  replied: number
  error: number
}

interface Campaign {
  id: string
  name: string
  goal: string
  status: string
  scheduled_at: string | null
  created_at: string
  stats: CampaignStats
}

const categoryColors: Record<string, string> = {
  introduction: "bg-primary/10 text-primary",
  "follow-up": "bg-amber-100 text-amber-700",
  camp: "bg-emerald-100 text-emerald-700",
  film: "bg-blue-100 text-blue-700",
  "thank-you": "bg-purple-100 text-purple-700",
}

const categoryLabels: Record<string, string> = {
  introduction: "Intro",
  "follow-up": "Follow-Up",
  camp: "Camp",
  film: "Film",
  "thank-you": "Thank You",
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
}

interface OutreachClientProps {
  templates: EmailTemplate[]
  programs: Program[]
  playerPosition: string
  gmailEmail: string | null
  gmailTier: string | null
  campaigns: Campaign[]
  resumeCampaignId?: string
  resumeStep?: string
  gmailStatus?: string
}

export function OutreachClient({
  templates,
  programs,
  playerPosition,
  gmailEmail,
  gmailTier,
  campaigns,
  resumeCampaignId,
  resumeStep,
  gmailStatus,
}: OutreachClientProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [showCreateCampaign, setShowCreateCampaign] = useState(false)
  const [togglingCampaign, setTogglingCampaign] = useState<string | null>(null)
  const [resumingCampaign, setResumingCampaign] = useState(false)

  // Handle resuming campaign after OAuth
  useEffect(() => {
    if (resumeCampaignId && gmailStatus === 'connected' && resumeStep === 'launch') {
      // Load the campaign and open the wizard at launch step
      const loadAndResumeCampaign = async () => {
        setResumingCampaign(true)
        try {
          // Fetch campaign details
          const res = await fetch(`/api/campaigns/${resumeCampaignId}`)
          if (!res.ok) {
            console.error('Failed to load campaign')
            return
          }
          
          const campaignData = await res.json()
          
          // TODO: Open CreateCampaignOverlay with the campaign data at launch step
          // For now, just show a message
          alert(`Welcome back! Your campaign "${campaignData.name}" is ready to launch. Click "New Campaign" to continue where you left off.`)
          
          // Clear the URL params
          const url = new URL(window.location.href)
          url.searchParams.delete('campaign')
          url.searchParams.delete('gmail')
          url.searchParams.delete('resume')
          window.history.replaceState({}, '', url.pathname + url.search)
        } catch (err) {
          console.error('Error resuming campaign:', err)
        } finally {
          setResumingCampaign(false)
        }
      }
      
      loadAndResumeCampaign()
    }
  }, [resumeCampaignId, gmailStatus, resumeStep])

  const handleToggleCampaign = async (campaignId: string, newStatus: string) => {
    setTogglingCampaign(campaignId)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        window.location.reload()
      }
    } catch (err) {
      console.error("Failed to toggle campaign:", err)
    } finally {
      setTogglingCampaign(null)
    }
  }

  // Aggregate stats
  const totalSent = campaigns.reduce((sum, c) => sum + c.stats.sent, 0)
  const totalOpened = campaigns.reduce((sum, c) => sum + c.stats.opened, 0)
  const totalReplied = campaigns.reduce((sum, c) => sum + c.stats.replied, 0)

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-foreground sm:text-3xl">
            Outreach Center
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage campaigns, templates, and track your outreach</p>
        </div>
        <Button
          onClick={() => setShowCreateCampaign(true)}
          className="bg-accent text-accent-foreground hover:bg-accent/90"
        >
          <Plus className="h-4 w-4" />
          Create Campaign
        </Button>
      </div>

      {showCreateCampaign && (
        <CreateCampaignOverlay
          programs={programs}
          playerPosition={playerPosition}
          gmailEmail={gmailEmail}
          gmailTier={gmailTier}
          onClose={() => setShowCreateCampaign(false)}
        />
      )}

      {/* Gmail connection status removed — users already logged in with Google.
         Gmail sending permissions will be requested just-in-time at campaign launch. */}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Templates", value: templates.length, icon: FileText, color: "primary" },
          { label: "Total Sent", value: totalSent, icon: Send, color: "accent" },
          { label: "Opened", value: totalOpened, icon: MailOpen, color: "primary" },
          { label: "Replied", value: totalReplied, icon: Reply, color: "primary" },
        ].map((stat) => (
          <Card key={stat.label} className="relative overflow-hidden">
            <div className={`absolute inset-x-0 top-0 h-0.5 ${stat.color === "accent" ? "bg-accent" : "bg-primary"}`} />
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${stat.color === "accent" ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary"}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-display text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Campaigns Section */}
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
              <Send className="h-4 w-4 text-accent" />
            </div>
            <CardTitle className="text-base font-bold">Campaigns</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {campaigns.length} total
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {campaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
                <Inbox className="h-7 w-7 text-muted-foreground/40" />
              </div>
              <p className="mt-4 text-sm font-semibold text-foreground">No campaigns yet</p>
              <p className="mt-1 max-w-[280px] text-xs text-muted-foreground">
                Create your first email campaign to start reaching out to college coaches.
              </p>
              <Button
                onClick={() => setShowCreateCampaign(true)}
                className="mt-4 bg-accent text-accent-foreground hover:bg-accent/90"
                size="sm"
              >
                <Plus className="h-4 w-4" />
                Create First Campaign
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {campaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="rounded-lg border border-border bg-secondary/30 p-4 transition-all hover:bg-secondary/50 hover:shadow-sm"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-foreground">{campaign.name}</h3>
                        <Badge className={`${statusColors[campaign.status] || statusColors.draft} border-0 text-[10px] font-semibold`}>
                          {campaign.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {goalLabels[campaign.goal] || campaign.goal} · Created {new Date(campaign.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                    {(campaign.status === "active" || campaign.status === "paused") && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={togglingCampaign === campaign.id}
                        onClick={() =>
                          handleToggleCampaign(
                            campaign.id,
                            campaign.status === "active" ? "paused" : "active"
                          )
                        }
                        className="shrink-0"
                      >
                        {togglingCampaign === campaign.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : campaign.status === "active" ? (
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

                  {/* Stats row */}
                  <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-border/50 pt-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      <span className="font-medium">{campaign.stats.total}</span> recipients
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Send className="h-3.5 w-3.5" />
                      <span className="font-medium">{campaign.stats.sent}</span> sent
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MailOpen className="h-3.5 w-3.5" />
                      <span className="font-medium">{campaign.stats.opened}</span> opened
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Reply className="h-3.5 w-3.5" />
                      <span className="font-medium">{campaign.stats.replied}</span> replied
                    </div>
                    {campaign.stats.error > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-red-500">
                        <XCircle className="h-3.5 w-3.5" />
                        <span className="font-medium">{campaign.stats.error}</span> errors
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Templates */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="flex-row items-center gap-2.5 pb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-base font-bold">Email Templates</CardTitle>
              <Badge variant="secondary" className="ml-auto text-xs">
                {templates.length} templates
              </Badge>
            </CardHeader>
            <CardContent className="pt-0">
              {templates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
                    <FileText className="h-7 w-7 text-muted-foreground/40" />
                  </div>
                  <p className="mt-4 text-sm font-semibold text-foreground">No templates yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">Create email templates to streamline your outreach.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => setSelectedTemplate(selectedTemplate === template.id ? null : template.id)}
                      className={`group flex flex-col rounded-lg border p-4 text-left transition-all ${
                        selectedTemplate === template.id
                          ? "border-primary/30 bg-primary/[0.03] shadow-sm"
                          : "border-transparent bg-secondary/40 hover:border-border hover:bg-secondary/70 hover:shadow-sm"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">{template.name}</span>
                            {template.category && (
                              <Badge className={`${categoryColors[template.category] || "bg-secondary text-secondary-foreground"} border-0 text-[10px] font-semibold`}>
                                {categoryLabels[template.category] || template.category}
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1.5 truncate text-xs text-muted-foreground">{template.subject}</p>
                        </div>
                        <ChevronRight className={`mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/30 transition-all ${
                          selectedTemplate === template.id ? "rotate-90 text-primary" : "group-hover:text-muted-foreground"
                        }`} />
                      </div>

                      {selectedTemplate === template.id && (
                        <div className="mt-3 flex items-center gap-2 border-t border-border/50 pt-3">
                          <button
                            type="button"
                            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Send className="h-3 w-3" />
                            Use Template
                          </button>
                          <button
                            type="button"
                            className="flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Eye className="h-3 w-3" />
                            Preview
                          </button>
                          <button
                            type="button"
                            className="flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Copy className="h-3 w-3" />
                            Duplicate
                          </button>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <Card className="flex flex-col">
            <CardHeader className="flex-row items-center gap-2.5 pb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
                <Send className="h-4 w-4 text-accent" />
              </div>
              <CardTitle className="text-base font-bold">Recent Sends</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 pt-0">
              {totalSent > 0 ? (
                <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                  <p>{totalSent} emails sent across {campaigns.filter(c => c.stats.sent > 0).length} campaigns</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
                    <Inbox className="h-7 w-7 text-muted-foreground/40" />
                  </div>
                  <p className="mt-4 text-sm font-semibold text-foreground">No outreach sent yet</p>
                  <p className="mt-1 max-w-[200px] text-xs text-muted-foreground">
                    Create a campaign to start sending outreach.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
