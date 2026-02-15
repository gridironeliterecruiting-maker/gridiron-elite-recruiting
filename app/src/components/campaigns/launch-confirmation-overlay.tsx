"use client"

import { useState } from "react"
import { ArrowLeft, Rocket, Mail, Users, AlertCircle, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { CampaignGoal } from "../create-campaign-overlay"
import type { EmailTemplate } from "./build-step"

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
  gmailTier: string | null
  campaignName: string
  scheduledAt: string | null
  launchNow: boolean
  onClose: () => void // For closing this overlay
  onConfirmLaunch: () => Promise<void> // The actual launch function passed from LaunchStep
  isLaunching: boolean
  launchError: string | null
  launchSuccess: boolean
}

const GOAL_LABELS: Record<CampaignGoal, { verb: string; highlight: string }> = {
  get_response: { verb: "introduce yourself and", highlight: "GET A RESPONSE" },
  evaluate_film: { verb: "get them to", highlight: "EVALUATE YOUR FILM" },
  build_interest: { verb: "share your story to", highlight: "BUILD INTEREST" },
  secure_visit: { verb: "discuss the details and", highlight: "SECURE A VISIT" },
}

export function LaunchConfirmationOverlay({
  goal,
  selectedCoaches,
  templates,
  gmailEmail,
  gmailTier,
  campaignName,
  scheduledAt,
  launchNow,
  onClose,
  onConfirmLaunch,
  isLaunching,
  launchError,
  launchSuccess,
}: LaunchConfirmationOverlayProps) {
  const programCount = new Set(selectedCoaches.map((sc) => sc.programId)).size
  const goalLabel = GOAL_LABELS[goal]

  const handleGmailConnect = () => {
    // Redirect to our backend's OAuth initiation endpoint
    window.location.href = "/api/gmail/authorize"
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

            {/* Gmail Status */}
            {!gmailEmail ? (
              <div className="rounded-lg border border-orange-200 bg-orange-50/50 p-4 text-center">
                <AlertCircle className="mx-auto h-6 w-6 text-orange-600" />
                <p className="mt-3 text-sm font-semibold text-orange-800">Gmail Connection Required</p>
                <p className="mt-1 text-xs text-orange-700">
                  To send emails, we need your permission to access your Gmail. This will happen on Google's site.
                </p>
                <Button
                  onClick={handleGmailConnect}
                  className="mt-4 bg-orange-600 text-white hover:bg-orange-700"
                  disabled={isLaunching}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Connect Gmail
                </Button>
              </div>
            ) : (
              <div className="rounded-lg border border-green-200 bg-green-50/50 p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                  <div>
                    <p className="text-sm font-semibold text-green-800">Gmail Connected</p>
                    <p className="mt-0.5 text-xs text-green-700">
                      Emails will be sent from <span className="font-bold">{gmailEmail}</span>.
                    </p>
                  </div>
                </div>
              </div>
            )}

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
                onClick={gmailEmail ? onConfirmLaunch : handleGmailConnect}
                disabled={isLaunching || launchSuccess || !gmailEmail}
                className="inline-flex items-center gap-2 rounded-md bg-accent px-6 py-2.5 text-sm font-semibold text-accent-foreground transition-all hover:bg-accent/90 shadow-sm disabled:opacity-50"
              >
                {isLaunching ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Launching...
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
