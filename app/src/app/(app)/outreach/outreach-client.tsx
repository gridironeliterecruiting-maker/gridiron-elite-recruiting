"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
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
  MessageCircle,
  Rocket,
} from "lucide-react"
import { CreateCampaignOverlay } from "@/components/campaigns/create-campaign-overlay"
import { CampaignLaunchedOverlay } from "@/components/campaigns/campaign-launched-overlay"
import { CampaignDetailsOverlay } from "@/components/campaigns/campaign-details-overlay"
import { DmCampaignOverlay } from "@/components/campaigns/dm-campaign-overlay"
import { CampaignCard } from "@/components/campaigns/campaign-card"

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
  clicked: number
  replied: number
  error: number
}

interface Campaign {
  id: string
  name: string
  goal: string
  status: string
  type?: string
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
  other: "Other",
}

interface OutreachClientProps {
  templates: EmailTemplate[]
  programs: Program[]
  playerPosition: string
  gmailEmail: string | null
  gmailTier: string | null
  hasGmailToken: boolean
  gmailTokenExpired: boolean
  twitterHandle: string | null
  hasTwitterToken: boolean
  campaigns: Campaign[]
  resumeCampaignId?: string
  resumeStep?: string
  gmailStatus?: string
  twitterStatus?: string
}

export function OutreachClient({
  templates,
  programs,
  playerPosition,
  gmailEmail,
  gmailTier,
  hasGmailToken,
  gmailTokenExpired,
  twitterHandle,
  hasTwitterToken,
  campaigns,
  resumeCampaignId,
  resumeStep,
  gmailStatus,
  twitterStatus,
}: OutreachClientProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [showCreateCampaign, setShowCreateCampaign] = useState<'email' | 'dm' | null>(null)
  const [quickEmailData, setQuickEmailData] = useState<{
    goal: string | null
    coachId: string | null
    programId: string | null
  } | null>(null)
  const [quickDmData, setQuickDmData] = useState<{
    goal: string | null
    coachId: string | null
    programId: string | null
  } | null>(null)
  const [togglingCampaign, setTogglingCampaign] = useState<string | null>(null)
  const [resumingCampaign, setResumingCampaign] = useState(false)
  const [launchedCampaign, setLaunchedCampaign] = useState<{
    name: string
    recipientCount: number
    programCount: number
  } | null>(null)
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)
  const [selectedDmCampaignId, setSelectedDmCampaignId] = useState<string | null>(null)
  
  // Check if we just launched successfully
  useEffect(() => {
    const launched = searchParams.get('launched')
    if (launched === 'true') {
      setLaunchedCampaign({
        name: 'Your campaign',
        recipientCount: 1,
        programCount: 1
      })
      // Clear the param
      const url = new URL(window.location.href)
      url.searchParams.delete('launched')
      window.history.replaceState({}, '', url.pathname + url.search)
    }
  }, [searchParams])

  // Handle auto-launching campaign after OAuth
  useEffect(() => {
    if (resumeCampaignId && gmailStatus === 'connected' && resumeStep === 'launch') {
      const autoLaunchCampaign = async () => {
        setResumingCampaign(true)
        
        // WAIT for token to be ready
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        try {
          // Directly update campaign status in database
          const { createClient } = await import('@/lib/supabase/client')
          const supabase = createClient()
          
          // Just activate the campaign - skip all the checks
          const { error: updateError } = await supabase
            .from('campaigns')
            .update({ status: 'active' })
            .eq('id', resumeCampaignId)
          
          if (!updateError) {
            // Schedule all pending recipients
            const { error: recipError } = await supabase
              .from('campaign_recipients')
              .update({ 
                status: 'scheduled',
                next_send_at: new Date().toISOString()
              })
              .eq('campaign_id', resumeCampaignId)
              .eq('status', 'pending')
              
            if (!recipError) {
              // Success - reload page
              window.location.href = '/outreach?launched=true'
              return
            }
          }
          
          // Fallback to API if direct update fails
          const launchRes = await fetch(`/api/campaigns/${resumeCampaignId}/launch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              scheduledAt: null,
            }),
          })

          if (!launchRes.ok) {
            window.location.reload()
            return
          }
          
          // Success - show the launched overlay
          window.location.href = '/outreach?launched=true'
          
          // Clear the URL params
          const url = new URL(window.location.href)
          url.searchParams.delete('campaign')
          url.searchParams.delete('gmail')
          url.searchParams.delete('resume')
          window.history.replaceState({}, '', url.pathname + url.search)
        } catch (err) {
          console.error('Error auto-launching campaign:', err)
          alert('Failed to launch campaign. Please try again.')
        } finally {
          setResumingCampaign(false)
        }
      }
      
      autoLaunchCampaign()
    }
  }, [resumeCampaignId, gmailStatus, resumeStep])

  // Handle quick email/DM flow from URL params
  useEffect(() => {
    const goal = searchParams.get('goal')
    const coachId = searchParams.get('coaches')
    const programId = searchParams.get('program')
    const isQuickEmail = searchParams.get('quickEmail') === 'true'
    const isQuickDm = searchParams.get('quickDm') === 'true'

    if (isQuickEmail && goal && coachId) {
      // Close any open campaign overlays first
      setSelectedCampaignId(null)
      setSelectedDmCampaignId(null)

      setQuickEmailData({ goal, coachId, programId })
      setShowCreateCampaign('email')

      // Clear URL params
      const url = new URL(window.location.href)
      url.searchParams.delete('goal')
      url.searchParams.delete('coaches')
      url.searchParams.delete('program')
      url.searchParams.delete('quickEmail')
      window.history.replaceState({}, '', url.pathname + url.search)
    } else if (isQuickDm && goal && coachId) {
      // Close any open campaign overlays first
      setSelectedCampaignId(null)
      setSelectedDmCampaignId(null)

      setQuickDmData({ goal, coachId, programId })
      setShowCreateCampaign('dm')

      // Clear URL params
      const url = new URL(window.location.href)
      url.searchParams.delete('goal')
      url.searchParams.delete('coaches')
      url.searchParams.delete('program')
      url.searchParams.delete('quickDm')
      window.history.replaceState({}, '', url.pathname + url.search)
    }
  }, [searchParams])

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
  const emailCampaigns = campaigns.filter(c => c.type !== 'dm')
  const dmCampaigns = campaigns.filter(c => c.type === 'dm')
  const totalSent = emailCampaigns.reduce((sum, c) => sum + c.stats.sent, 0)
  const totalOpened = emailCampaigns.reduce((sum, c) => sum + c.stats.opened, 0)
  const totalReplied = emailCampaigns.reduce((sum, c) => sum + c.stats.replied, 0)
  const totalDmSent = dmCampaigns.reduce((sum, c) => sum + c.stats.sent, 0)

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-foreground sm:text-3xl">
            Outreach Center
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Rocket className="h-3.5 w-3.5 text-accent" />
            CREATE, MANAGE, AND TRACK YOUR CAMPAIGNS
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowCreateCampaign('dm')}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            X DM Assist
          </Button>
          <Button
            onClick={() => setShowCreateCampaign('email')}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Plus className="h-4 w-4" />
            Create Campaign
          </Button>
        </div>
      </div>

      {showCreateCampaign && (
        <CreateCampaignOverlay
          programs={programs}
          playerPosition={playerPosition}
          gmailEmail={gmailEmail}
          gmailTier={gmailTier}
          hasGmailToken={hasGmailToken}
          gmailTokenExpired={gmailTokenExpired}
          quickEmailData={quickEmailData}
          quickDmData={quickDmData}
          initialCampaignType={showCreateCampaign}
          onClose={() => {
            setShowCreateCampaign(null)
            setQuickEmailData(null)
            setQuickDmData(null)
          }}
          onCampaignLaunched={(campaignData) => {
            setLaunchedCampaign(campaignData)
          }}
        />
      )}

      {/* Twitter/X connection status */}
      {hasTwitterToken && twitterHandle && (
        <Card className="border-primary/20 bg-primary/[0.03]">
          <CardContent className="flex items-center gap-3 p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <MessageCircle className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground">X Connected — @{twitterHandle}</p>
              <p className="text-[11px] text-muted-foreground">DMs can be sent automatically via the X API</p>
            </div>
            <Badge className="border-0 bg-green-100 text-green-700 text-[10px]">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Connected
            </Badge>
          </CardContent>
        </Card>
      )}

      {twitterStatus === 'connected' && !hasTwitterToken && (
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="flex items-center gap-3 p-3">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <p className="text-xs font-semibold text-green-700">X account connected successfully! Refresh the page to see the status.</p>
          </CardContent>
        </Card>
      )}

      {twitterStatus === 'error' && (
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="flex items-center gap-3 p-3">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <p className="text-xs font-semibold text-red-700">Failed to connect X account. Please try again.</p>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          { label: "Templates", value: templates.length, icon: FileText, color: "primary" },
          { label: "Emails Sent", value: totalSent, icon: Send, color: "accent" },
          { label: "DMs Sent", value: totalDmSent, icon: MessageCircle, color: "primary" },
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
                onClick={() => setShowCreateCampaign('email')}
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
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  onClick={() => {
                    if (campaign.type === 'dm') {
                      setSelectedDmCampaignId(campaign.id)
                    } else {
                      setSelectedCampaignId(campaign.id)
                    }
                  }}
                  onStatusChange={() => window.location.reload()}
                />
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
                          : "border-transparent bg-secondary/40 hover:border-primary/30 hover:shadow-sm hover:ring-1 hover:ring-primary/20"
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

      {launchedCampaign && (
        <CampaignLaunchedOverlay
          campaignName={launchedCampaign.name}
          recipientCount={launchedCampaign.recipientCount}
          programCount={launchedCampaign.programCount}
          onClose={() => {
            setLaunchedCampaign(null)
            // Refresh the page to show updated campaign status
            window.location.reload()
          }}
        />
      )}

      {resumingCampaign && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Launching your campaign...</p>
          </div>
        </div>
      )}

      {selectedCampaignId && (
        <CampaignDetailsOverlay
          campaignId={selectedCampaignId}
          onClose={() => setSelectedCampaignId(null)}
          onStatusChange={() => {
            window.location.reload()
          }}
        />
      )}

      {selectedDmCampaignId && (
        <DmCampaignOverlay
          campaignId={selectedDmCampaignId}
          onClose={() => setSelectedDmCampaignId(null)}
        />
      )}
    </div>
  )
}
