'use client'

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MailOpen, Users, Play, Pause, Rocket, AlertCircle, MessageCircle } from "lucide-react"
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
      replied: number
      error: number
    }
  }
  onClick: () => void
  onStatusChange?: () => void
}

export function CampaignCard({ campaign, onClick, onStatusChange }: CampaignCardProps) {
  const [isLaunching, setIsLaunching] = useState(false)
  const [launchError, setLaunchError] = useState<string | null>(null)

  const isDm = campaign.type === 'dm'

  const handleLaunch = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsLaunching(true)
    setLaunchError(null)

    try {
      // First, try to refresh the token if needed
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

      // Reload to refresh state
      window.location.reload()
    } catch (err) {
      setLaunchError('Failed to launch campaign')
    } finally {
      setIsLaunching(false)
    }
  }

  const isPaused = campaign.status === 'paused'
  const isDraft = campaign.status === 'draft'
  const openRate = campaign.stats.sent > 0
    ? Math.round((campaign.stats.opened / campaign.stats.sent) * 100)
    : 0

  return (
    <Card
      className="relative overflow-hidden transition-all hover:shadow-md cursor-pointer"
      onClick={onClick}
    >
      <div className="p-6">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            {isDm && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MessageCircle className="h-4 w-4" />
              </div>
            )}
            <div>
              <h3 className="font-semibold text-foreground">{campaign.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {isDm ? 'DM Campaign' : 'Email Campaign'} · Created {new Date(campaign.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isPaused && (
              <span className="flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
                <Pause className="h-3 w-3" />
                Paused
              </span>
            )}
            {isDraft && !isDm && (
              <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800">
                Draft
              </span>
            )}
            {campaign.status === 'active' && (
              <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                <Play className="h-3 w-3" />
                Active
              </span>
            )}
            {campaign.status === 'completed' && (
              <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                Complete
              </span>
            )}
          </div>
        </div>

        {isDm ? (
          /* DM stats */
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MessageCircle className="h-4 w-4" />
                <span>{campaign.stats.sent}/{campaign.stats.total} DMs sent</span>
              </div>
            </div>
            <div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: campaign.stats.total > 0
                      ? `${Math.round((campaign.stats.sent / campaign.stats.total) * 100)}%`
                      : '0%'
                  }}
                />
              </div>
            </div>
          </div>
        ) : (
          /* Email stats */
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>{campaign.stats.sent} sent</span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MailOpen className="h-4 w-4" />
                <span>{openRate}% opened</span>
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">
                {campaign.stats.replied} replies
              </div>
            </div>
          </div>
        )}

        {isDraft && !isDm && (
          <div className="mt-4">
            {launchError && (
              <div className="mb-2 flex items-center gap-2 text-xs text-red-600">
                <AlertCircle className="h-3 w-3" />
                {launchError}
              </div>
            )}
            <Button
              size="sm"
              onClick={handleLaunch}
              disabled={isLaunching}
              className="w-full"
            >
              {isLaunching ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
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
      </div>
    </Card>
  )
}
