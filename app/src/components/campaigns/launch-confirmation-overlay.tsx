"use client"

import { useState } from "react"
import { ArrowLeft, Rocket, Mail, Users, AlertCircle, CheckCircle2, Calendar, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { CampaignGoal, EmailTemplate } from "../campaigns/types"

interface SelectedCoach {
  coachId: string
  programId: string
  programName: string
  coachName: string
  title: string
  email: string
}

interface LaunchConfirmationOverlayProps {
  goal: CampaignGoal
  selectedCoaches: SelectedCoach[]
  templates: EmailTemplate[]
  gmailEmail: string | null
  hasGmailToken: boolean
  gmailTokenExpired: boolean
  campaignName: string
  scheduledAt: string | null
  launchNow: boolean
  activePlayerId?: string | null
  onClose: () => void // For closing this overlay
  onConfirmLaunch: () => Promise<void> // The actual launch function passed from LaunchStep
  isLaunching: boolean
  launchError: string | null
  launchSuccess: boolean
  setIsLaunching: (value: boolean) => void
}

const GOAL_LABELS: Record<CampaignGoal, { verb: string; highlight: string }> = {
  get_response: { verb: "introduce yourself and", highlight: "GET A RESPONSE" },
  evaluate_film: { verb: "get them to", highlight: "EVALUATE YOUR FILM" },
  build_interest: { verb: "share your story to", highlight: "BUILD INTEREST" },
  secure_visit: { verb: "discuss the details and", highlight: "SECURE A VISIT" },
  other: { verb: "send a custom", highlight: "MESSAGE" },
}

export function LaunchConfirmationOverlay({
  goal,
  selectedCoaches,
  templates,
  gmailEmail,
  hasGmailToken,
  gmailTokenExpired,
  campaignName,
  scheduledAt,
  launchNow,
  activePlayerId,
  onClose,
  onConfirmLaunch,
  isLaunching,
  launchError,
  launchSuccess,
  setIsLaunching,
}: LaunchConfirmationOverlayProps) {
  const [checkingGmail, setCheckingGmail] = useState(false)
  const [hasValidGmail, setHasValidGmail] = useState(hasGmailToken && !gmailTokenExpired)
  const [refreshedEmail, setRefreshedEmail] = useState<string | null>(null)
  const programCount = new Set(selectedCoaches.map((sc) => sc.programId)).size
  const goalLabel = GOAL_LABELS[goal]
  
  // Use refreshed email if available, otherwise use prop
  const currentGmailEmail = refreshedEmail || gmailEmail

  const handleLaunchClick = async () => {
    // ALWAYS try to refresh first if token exists
    if (hasGmailToken && gmailTokenExpired) {
      setCheckingGmail(true)
      setIsLaunching(true)
      
      try {
        const res = await fetch('/api/gmail/force-refresh')
        const data = await res.json()
        
        if (data.success) {
          // Token refreshed! Now launch
          await new Promise(resolve => setTimeout(resolve, 500))
          await onConfirmLaunch()
          return
        }
      } catch (error) {
        console.error('Auto refresh failed:', error)
      }
      
      setCheckingGmail(false)
      setIsLaunching(false)
    }
    
    if (hasValidGmail) {
      // Gmail is valid, proceed with launch
      await onConfirmLaunch()
    } else {
      // Check if we can refresh the token first
      console.log('Token expired or missing, attempting refresh...')
      setCheckingGmail(true)
      setIsLaunching(true)
      
      try {
        console.log('Calling /api/gmail/refresh...')
        // Get the session token for auth
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        
        const refreshRes = await fetch('/api/gmail/refresh', { 
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': session?.access_token ? `Bearer ${session.access_token}` : '',
          }
        })
        console.log('Refresh response status:', refreshRes.status)
        
        if (!refreshRes.ok) {
          console.error('Refresh response not OK:', refreshRes.status, refreshRes.statusText)
          const errorText = await refreshRes.text()
          console.error('Error response:', errorText)
        } else {
          const refreshData = await refreshRes.json()
          console.log('Refresh response data:', refreshData)
          
          if (refreshData.success) {
            // Token refreshed successfully, proceed with launch
            console.log('Token refresh successful! Proceeding with launch...')
            setHasValidGmail(true)
            setRefreshedEmail(refreshData.email)
            setCheckingGmail(false)
            
            // Small delay to ensure token is propagated
            await new Promise(resolve => setTimeout(resolve, 500))
            
            await onConfirmLaunch()
            return
          } else {
            console.log('Refresh response indicates failure:', refreshData)
          }
        }
      } catch (error) {
        console.error('Token refresh exception:', error)
      }
      
      // Refresh failed or no token, need to connect Gmail
      console.log('Refresh failed, redirecting to Gmail auth...')
      setCheckingGmail(false)
      await handleGmailConnect()
    }
  }

  const handleGmailConnect = async () => {
    // Save the campaign as a draft before redirecting
    try {
      const createRes = await fetch('/api/campaigns/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: campaignName,
          goal,
          playerId: activePlayerId || undefined,
          templates: templates.map((t) => ({
            subject: t.subject,
            body: t.body,
            delayDays: t.delayDays,
            name: t.name,
          })),
          recipients: selectedCoaches.map(c => ({
            coachId: c.coachId,
            coachName: c.coachName,
            email: c.email,
            programName: c.programName,
          })),
          scheduledAt: launchNow ? null : (scheduledAt ? new Date(scheduledAt).toISOString() : null),
          status: 'draft', // Save as draft
        }),
      })

      const data = await createRes.json()
      if (!createRes.ok) {
        throw new Error(data.error || 'Failed to save campaign')
      }

      // Redirect to OAuth with campaign ID in state
      // Include returnTo so after Gmail connect user lands back at the right slug path
      const segs = window.location.pathname.split('/').filter(Boolean)
      const appRoutes = ['hub','coaches','pipeline','outreach','profile']
      const base = segs.length >= 2 && appRoutes.includes(segs[1]) ? `/${segs[0]}` : ''
      window.location.href = `/api/gmail/authorize?campaign=${data.campaignId}&returnTo=${encodeURIComponent(`${base}/outreach`)}`
    } catch (error) {
      setIsLaunching(false)
      alert('Failed to save campaign. Please try again.')
    }
  }

  return (
    <div className="animate-in slide-in-from-bottom-8 fade-in fixed inset-0 z-[70] overflow-y-auto bg-background/80 backdrop-blur-sm duration-300">
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg rounded-xl shadow-2xl">
          <div className="flex flex-col gap-6 p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Rocket className="h-6 w-6" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold uppercase tracking-tight text-foreground">
                  Ready to Go Live?
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">Confirm details before launching your campaign.</p>
              </div>
            </div>

            {/* Campaign Summary */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 shrink-0 text-primary" />
                <span className="font-semibold text-foreground">Campaign:</span>
                <span className="text-muted-foreground">{campaignName}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 shrink-0 text-primary" />
                <span className="font-semibold text-foreground">Recipients:</span>
                <span className="text-muted-foreground">
                  {selectedCoaches.length} coaches across {programCount} programs
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Rocket className="h-4 w-4 shrink-0 text-primary" />
                <span className="font-semibold text-foreground">Goal:</span>
                <span className="text-muted-foreground">
                  {goalLabel.verb} <span className="font-bold">{goalLabel.highlight}</span>
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 shrink-0 text-primary" />
                <span className="font-semibold text-foreground">Schedule:</span>
                <span className="text-muted-foreground">
                  {launchNow ? "Launch Now" : new Date(scheduledAt || "").toLocaleString()}
                </span>
              </div>
            </div>

            {/* Final Confirmation */}
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-center">
              <AlertCircle className="mx-auto h-6 w-6 text-primary" />
              <p className="mt-3 text-sm font-semibold text-primary">Are you sure?</p>
              <p className="mt-1 text-xs text-muted-foreground">
                When you confirm your name will be in the selected coaches Inbox!
              </p>
            </div>

            {/* Launch Error */}
            {launchError && (
              <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Launch Failed</p>
                  <p className="mt-1 text-xs text-red-600">{launchError}</p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-4 flex items-center justify-between gap-4 border-t border-border pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLaunching || launchSuccess}
                className="text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleLaunchClick}
                disabled={isLaunching || launchSuccess}
                className="inline-flex items-center gap-2 rounded-md bg-accent px-6 py-2.5 text-sm font-semibold text-accent-foreground transition-all hover:bg-accent/90 shadow-sm disabled:opacity-50"
              >
                {isLaunching ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {checkingGmail ? 'Checking Gmail...' : 'Launching...'}
                  </>
                ) : launchSuccess ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Launched!
                  </>
                ) : (
                  <>
                    <Rocket className="h-4 w-4" />
                    Let's Go 🚀
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
