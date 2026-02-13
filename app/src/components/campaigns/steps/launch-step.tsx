"use client"

import { useState } from "react"
import {
  Target,
  Mail,
  Users,
  Calendar,
  Clock,
  Rocket,
  X,
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
  const [showSchedule, setShowSchedule] = useState(false)

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

      <div className="flex flex-col gap-4 max-w-2xl">
        {/* Campaign Name */}
        <Card className="p-4">
          <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Campaign Name
          </label>
          <input
            type="text"
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground placeholder:text-muted-foreground/50 focus:border-primary/30 focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
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
      <div className="mt-8 flex items-center justify-between border-t border-border pt-6 max-w-2xl">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md bg-secondary px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-secondary/80"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => setShowSchedule(true)}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-6 py-2.5 text-sm font-semibold text-accent-foreground transition-all hover:bg-accent/90 shadow-sm"
        >
          <Calendar className="h-4 w-4" />
          Schedule
        </button>
      </div>

      {/* Schedule Overlay */}
      {showSchedule && (
        <ScheduleOverlay
          campaignName={campaignName}
          coachCount={selectedCoaches.length}
          emailCount={templates.length}
          onLaunch={(date) => {
            // TODO: Wire to Instantly API
            console.log("Launch campaign:", { campaignName, date })
            setShowSchedule(false)
          }}
          onClose={() => setShowSchedule(false)}
        />
      )}
    </div>
  )
}

// ─── Schedule Overlay ───────────────────────────────────────────
function ScheduleOverlay({
  campaignName,
  coachCount,
  emailCount,
  onLaunch,
  onClose,
}: {
  campaignName: string
  coachCount: number
  emailCount: number
  onLaunch: (date: Date | null) => void
  onClose: () => void
}) {
  // Default: next Tuesday at 10:00 AM (research shows Tue-Thu mornings optimal)
  const getDefaultDate = () => {
    const now = new Date()
    const day = now.getDay()
    // Next Tuesday
    const daysUntilTue = day <= 2 ? 2 - day : 9 - day
    const next = new Date(now)
    next.setDate(now.getDate() + (daysUntilTue === 0 ? 7 : daysUntilTue))
    next.setHours(10, 0, 0, 0)
    return next
  }

  const [scheduledDate, setScheduledDate] = useState(() => {
    const d = getDefaultDate()
    return d.toISOString().slice(0, 16)
  })

  return (
    <div className="animate-in slide-in-from-right-8 fade-in fixed inset-y-0 right-0 z-[70] flex w-full max-w-md flex-col border-l border-border bg-background shadow-2xl duration-200">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <h3 className="flex-1 font-display text-sm font-bold uppercase tracking-tight text-foreground">
          Schedule Campaign
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        {/* Summary */}
        <div className="mb-6 rounded-lg border border-border bg-secondary/30 p-4">
          <p className="text-sm font-semibold text-foreground">{campaignName}</p>
          <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" /> {coachCount} coaches
            </span>
            <span className="flex items-center gap-1">
              <Mail className="h-3 w-3" /> {emailCount} emails
            </span>
          </div>
        </div>

        {/* Recommendation */}
        <div className="mb-6 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">💡 Recommended:</span>{" "}
            Research shows that emails sent on <span className="font-semibold">Tuesday through Thursday</span> between{" "}
            <span className="font-semibold">9:00–11:00 AM</span> in the recipient&apos;s time zone get the highest open and response rates from college coaches.
          </p>
        </div>

        {/* Date/Time Picker */}
        <div className="mb-6">
          <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Send Date & Time
          </label>
          <input
            type="datetime-local"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:border-primary/30 focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            Defaulted to next Tuesday at 10:00 AM for optimal response rates.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => onLaunch(new Date(scheduledDate))}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Calendar className="h-4 w-4" />
            Schedule for {new Date(scheduledDate).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </button>

          <div className="relative flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <button
            type="button"
            onClick={() => onLaunch(null)}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/90"
          >
            <Rocket className="h-4 w-4" />
            Launch Now
          </button>
        </div>
      </div>
    </div>
  )
}
