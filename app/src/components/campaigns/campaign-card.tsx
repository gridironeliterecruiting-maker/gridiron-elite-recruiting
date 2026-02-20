'use client'

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MailOpen, Users, Play, Pause, Rocket, AlertCircle } from "lucide-react"
import { useState } from "react"

interface CampaignCardProps {
  campaign: {
    id: string
    name: string
    status: string
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
  
  const handleLaunch = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsLaunching(true)
    setLaunchError(null)
    
    try {
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
          <div>
            <h3 className="font-semibold text-foreground">{campaign.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Created {new Date(campaign.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isPaused && (
              <span className="flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
                <Pause className="h-3 w-3" />
                Paused
              </span>
            )}
            {isDraft && (
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
          </div>
        </div>

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
        
        {isDraft && (
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