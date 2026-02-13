"use client"

import { useState } from "react"
import { ArrowLeft, Mail, Check } from "lucide-react"
import { GoalStep } from "./steps/goal-step"

export type CampaignGoal = "get_response" | "evaluate_film" | "build_interest" | "secure_visit"

export interface CampaignDraft {
  goal: CampaignGoal | null
  // Future steps will add more fields here
}

const STEPS = [
  { number: 1, label: "Goal" },
  { number: 2, label: "Target" },
  { number: 3, label: "Build" },
  { number: 4, label: "Launch" },
] as const

interface CreateCampaignOverlayProps {
  onClose: () => void
}

export function CreateCampaignOverlay({ onClose }: CreateCampaignOverlayProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [draft, setDraft] = useState<CampaignDraft>({ goal: null })

  const handleGoalSelect = (goal: CampaignGoal) => {
    setDraft((prev) => ({ ...prev, goal }))
    setCurrentStep(2)
  }

  return (
    <div className="animate-in slide-in-from-right-8 fade-in fixed inset-0 z-[60] overflow-y-auto bg-background duration-300">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-card shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3 lg:px-8">
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
            aria-label="Close"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
              <Mail className="h-5 w-5" />
            </div>
            <h1 className="font-display text-lg font-bold uppercase tracking-tight text-foreground sm:text-xl">
              New Email Campaign
            </h1>
          </div>
        </div>

        {/* Progress Tracker */}
        <div className="mx-auto max-w-5xl px-4 pb-4 lg:px-8">
          <div className="flex items-center gap-0">
            {STEPS.map((step, i) => (
              <div key={step.number} className="flex flex-1 items-center">
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                      currentStep > step.number
                        ? "bg-primary text-primary-foreground"
                        : currentStep === step.number
                          ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                          : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {currentStep > step.number ? <Check className="h-3.5 w-3.5" /> : step.number}
                  </div>
                  <span
                    className={`text-xs font-semibold uppercase tracking-wider ${
                      currentStep >= step.number ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`mx-3 h-0.5 flex-1 rounded-full transition-colors ${
                      currentStep > step.number ? "bg-primary" : "bg-border"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="mx-auto max-w-5xl px-4 py-8 lg:px-8">
        {currentStep === 1 && (
          <GoalStep onSelect={handleGoalSelect} selected={draft.goal} />
        )}

        {currentStep === 2 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-muted-foreground">Step 2 — Target (coming soon)</p>
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="mt-4 rounded-md bg-secondary px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-secondary/80"
            >
              Back to Goal
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
