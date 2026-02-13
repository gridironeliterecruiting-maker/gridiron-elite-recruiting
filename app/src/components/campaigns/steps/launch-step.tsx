"use client"

import { useState } from "react"
import {
  Target,
  Mail,
  Users,
  Calendar,
  Rocket,
  Edit2,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import type { CampaignGoal } from "../create-campaign-overlay"
import type { EmailTemplate } from "./build-step"

const GOAL_LABELS: Record<CampaignGoal, { verb: string; highlight: string }> = {
  get_response: { verb: "introduce yourself and", highlight: "GET A RESPONSE" },
  evaluate_film: { verb: "get them to", highlight: "EVALUATE YOUR FILM" },
  build_interest: { verb: "share your story to", highlight: "BUILD INTEREST" },
  secure_visit: { verb: "discuss the details and", highlight: "SECURE A VISIT" },
}

interface SelectedCoach {
  coachId: string
  programId: string
  programName: string
  coachName: string
  title: string
  email: string
}

interface LaunchStepProps {
  goal: CampaignGoal
  selectedCoaches: SelectedCoach[]
  templates: EmailTemplate[]
  onEditTarget: () => void
  onEditBuild: () => void
  onBack: () => void
}

export function LaunchStep({
  goal,
  selectedCoaches,
  templates,
  onEditTarget,
  onEditBuild,
  onBack,
}: LaunchStepProps) {
  const [campaignName, setCampaignName] = useState("Initial Email 1")
  
  // Default to now
  const getNowLocal = () => {
    const now = new Date()
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
    return now.toISOString().slice(0, 16)
  }
  const [scheduledDate, setScheduledDate] = useState(getNowLocal)
  const [launchNow, setLaunchNow] = useState(true)

  const goalLabel = GOAL_LABELS[goal]
  const programCount = new Set(selectedCoaches.map((sc) => sc.programId)).size

  return (
    <div className="relative">
      <div className="mb-6">
        <h2 className="mb-2 font-display text-base font-bold uppercase tracking-wider text-foreground">
          Review & Launch
        </h2>
        <p className="text-sm text-muted-foreground">
          Review your campaign details before launching.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {/* Campaign Name */}
        <Card className="p-4">
          <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Campaign Name
          </label>
          <input
            type="text"
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            className="max-w-md rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground placeholder:text-muted-foreground/50 focus:border-primary/30 focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </Card>

        {/* Launch Date & Time */}
        <Card className="p-4">
          <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Launch Date & Time
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => { setLaunchNow(true); setScheduledDate(getNowLocal()) }}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-all ${
                launchNow
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              <Rocket className="h-3.5 w-3.5" />
              Launch Now
            </button>
            <button
              type="button"
              onClick={() => setLaunchNow(false)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-all ${
                !launchNow
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              Schedule
            </button>
            {!launchNow && (
              <input
                type="datetime-local"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary/30 focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            )}
          </div>
          {!launchNow && (
            <p className="mt-2 text-[10px] text-muted-foreground">
              💡 Tip: Emails sent Tuesday–Thursday between 9–11 AM get the best response rates from coaches.
            </p>
          )}
        </Card>

        {/* Goal */}
        <Card className="flex items-start gap-4 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Goal</p>
            <p className="mt-1 text-sm text-foreground">
              The goal of this campaign is to {goalLabel.verb}{" "}
              <span className="font-bold text-primary">{goalLabel.highlight}</span>.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Programs that respond are automatically added to your pipeline.
            </p>
          </div>
        </Card>

        {/* Recipients */}
        <Card className="flex items-start gap-4 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Users className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Recipients</p>
            <p className="mt-1 text-sm text-foreground">
              You have targeted{" "}
              <span className="font-bold text-primary">{selectedCoaches.length} coaches</span>
              {" "}across{" "}
              <span className="font-bold">{programCount} programs</span>.
            </p>
          </div>
          <button
            type="button"
            onClick={onEditTarget}
            className="mt-1 inline-flex items-center gap-1 rounded-md bg-secondary px-3 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground"
          >
            <Edit2 className="h-3 w-3" />
            Edit
          </button>
        </Card>

        {/* Sequence */}
        <Card className="flex items-start gap-4 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Mail className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Email Sequence</p>
            <p className="mt-1 text-sm text-foreground">
              You have scheduled{" "}
              <span className="font-bold text-primary">{templates.length} sequential email{templates.length !== 1 ? "s" : ""}</span>
              {" "}in this campaign.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {templates.map((t, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary/50 px-2 py-0.5 text-[10px] text-muted-foreground"
                >
                  {i + 1}. {t.name}
                  {t.delayDays !== null && (
                    <span className="text-muted-foreground/60">· {t.delayDays}d</span>
                  )}
                </span>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={onEditBuild}
            className="mt-1 inline-flex items-center gap-1 rounded-md bg-secondary px-3 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground"
          >
            <Edit2 className="h-3 w-3" />
            Edit
          </button>
        </Card>
      </div>

      {/* Navigation */}
      <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md bg-secondary px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-secondary/80"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => {
            // TODO: Wire to Instantly API
            const date = launchNow ? new Date() : new Date(scheduledDate)
            console.log("Launch campaign:", { campaignName, date, launchNow })
          }}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-6 py-2.5 text-sm font-semibold text-accent-foreground transition-all hover:bg-accent/90 shadow-sm"
        >
          <Rocket className="h-4 w-4" />
          {launchNow ? "Launch Campaign" : `Schedule Campaign`}
        </button>
      </div>
    </div>
  )
}
