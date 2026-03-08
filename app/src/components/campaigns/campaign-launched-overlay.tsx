"use client"

import { CheckCircle2, X, Mail, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface CampaignLaunchedOverlayProps {
  campaignName: string
  recipientCount: number
  programCount: number
  onClose: () => void
}

export function CampaignLaunchedOverlay({
  campaignName,
  recipientCount,
  programCount,
  onClose,
}: CampaignLaunchedOverlayProps) {
  return (
    <div className="animate-in slide-in-from-bottom-8 fade-in fixed inset-0 z-[70] overflow-y-auto bg-background/80 backdrop-blur-sm duration-300">
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <Card className="relative w-full max-w-lg rounded-xl shadow-2xl">
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
          
          <div className="flex flex-col gap-6 p-8 text-center">
            {/* Success Icon */}
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>

            {/* Success Message */}
            <div>
              <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-foreground">
                Campaign Launched! 🚀
              </h2>
              <p className="mt-2 text-base text-muted-foreground">
                Your emails are on their way to coaches
              </p>
            </div>

            {/* Campaign Details */}
            <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  Campaign:
                </span>
                <span className="font-semibold">{campaignName}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  Recipients:
                </span>
                <span className="font-semibold">
                  {recipientCount} coaches • {programCount} programs
                </span>
              </div>
            </div>

            {/* Next Steps */}
            <div className="text-left">
              <p className="mb-2 text-sm font-semibold text-foreground">What happens next:</p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  <span>Emails are being sent from your Gmail</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  <span>Track opens and replies in the Pipeline</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  <span>Follow-ups send automatically on schedule</span>
                </li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={onClose}
                className="flex-1"
              >
                Back to Outreach
              </Button>
              <Button 
                onClick={() => {
                  const segs = window.location.pathname.split('/').filter(Boolean)
                  const appRoutes = ['hub','coaches','pipeline','outreach','profile']
                  const base = segs.length >= 2 && appRoutes.includes(segs[1]) ? `/${segs[0]}` : ''
                  window.location.href = `${base}/pipeline`
                }}
                className="flex-1 bg-primary"
              >
                View Pipeline
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}