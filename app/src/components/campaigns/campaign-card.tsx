'use client'

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Mail, MailOpen, Users, Play, Pause, Rocket, AlertCircle, MessageCircle, Reply, MousePointerClick } from "lucide-react"
import { useState } from "react"

interface CampaignCardProps {
  campaign: {
    id: string
    name: string
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
  }
  onClick: () => void
  onStatusChange?: () => void
}

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-gray-100 text-gray-700" },
  active: { label: "Active", className: "bg-emerald-100 text-emerald-700" },
  paused: { label: "Paused", className: "bg-amber-100 text-amber-700" },
  completed: { label: "Complete", className: "bg-blue-100 text-blue-700" },
  cancelled: { label: "Cancelled", className: "bg-red-100 text-red-700" },
}

export function CampaignCard({ campaign, onClick, onStatusChange }: CampaignCardProps) {
  const [isLaunching, setIsLaunching] = useState(false)
  const [launchError, setLaunchError] = useState<string | null>(null)

  const isDm = campaign.type === 'dm'
  const isDraft = campaign.status === 'draft'

  const openRate = campaign.stats.sent > 0
    ? Math.round((campaign.stats.opened / campaign.stats.sent) * 100)
    : 0

  const handleLaunch = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsLaunching(true)
    setLaunchError(null)

    try {
      const refreshRes = await fetch('/api/gmail/force-refresh')
      if (refreshRes.ok) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      const res = await fetch(`/api/campaigns/${campaign.id}/launch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledAt: null })
      })

      if (!res.ok) {
        const error = await res.json()
        setLaunchError(error.error || 'Failed to launch')
        return
      }

      window.location.reload()
    } catch (err) {
      setLaunchError('Failed to launch campaign')
    } finally {
      setIsLaunching(false)
    }
  }

  const status = statusConfig[campaign.status] || statusConfig.draft

  return (
    <Card
      className="relative overflow-hidden transition-all hover:shadow-md cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center gap-3 p-3">
        {/* Icon */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {isDm ? <MessageCircle className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
        </div>

        {/* Name + Status + Subtitle */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-foreground">{campaign.name}</span>
            <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.className}`}>
              {status.label}
            </span>
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {isDm ? 'DM Campaign' : 'Email Campaign'} · {new Date(campaign.created_at).toLocaleDateString()}
          </p>
        </div>

        {/* Stats — evenly spaced */}
        {isDm ? (
          <div className="hidden shrink-0 sm:grid sm:grid-cols-4 sm:gap-6">
            <div className="col-start-4 flex flex-col items-center">
              <p className="text-sm font-semibold text-foreground">{campaign.stats.sent}/{campaign.stats.total}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sent</p>
            </div>
          </div>
        ) : (
          <div className="hidden shrink-0 sm:grid sm:grid-cols-4 sm:gap-6">
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">{campaign.stats.total}</span>
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Recipients</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1">
                <MailOpen className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">{openRate}%</span>
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Open</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1">
                <MousePointerClick className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">{campaign.stats.clicked || 0}</span>
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Clicks</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1">
                <Reply className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">{campaign.stats.replied}</span>
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Replies</p>
            </div>
          </div>
        )}
      </div>

      {/* Draft launch button */}
      {isDraft && !isDm && (
        <div className="border-t px-3 py-2">
          {launchError && (
            <div className="mb-1.5 flex items-center gap-2 text-xs text-red-600">
              <AlertCircle className="h-3 w-3" />
              {launchError}
            </div>
          )}
          <Button
            size="sm"
            onClick={handleLaunch}
            disabled={isLaunching}
            className="w-full px-3 py-2"
          >
            {isLaunching ? (
              <>
                <span className="animate-spin mr-2">&#9203;</span>
                Launching...
              </>
            ) : (
              <>
                <Rocket className="h-4 w-4 mr-2" />
                Launch Campaign
              </>
            )}
          </Button>
        </div>
      )}
    </Card>
  )
}
