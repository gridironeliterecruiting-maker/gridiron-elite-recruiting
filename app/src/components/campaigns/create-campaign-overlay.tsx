"use client"

import { useState } from "react"
import { ArrowLeft, Mail, Check } from "lucide-react"
import { GoalStep } from "./steps/goal-step"
import { TargetStep } from "./steps/target-step"
import { BuildStep } from "./steps/build-step"
import { LaunchStep } from "./steps/launch-step"
import type { EmailTemplate } from "./steps/build-step"

export type CampaignGoal = "get_response" | "evaluate_film" | "build_interest" | "secure_visit"

interface SelectedCoach {
  coachId: string
  programId: string
  programName: string
  coachName: string
  title: string
  email: string
}

export interface CampaignDraft {
  goal: CampaignGoal | null
  selectedCoaches: SelectedCoach[]
  templates: EmailTemplate[]
}

interface Program {
  id: string
  school_name: string
  division: string
  conference: string
  logo_url: string | null
}

const STEPS = [
  { number: 1, label: "Goal" },
  { number: 2, label: "Target" },
  { number: 3, label: "Build" },
  { number: 4, label: "Launch" },
] as const

interface CreateCampaignOverlayProps {
  programs: Program[]
  playerPosition: string
  onClose: () => void
}

export function CreateCampaignOverlay({ programs, playerPosition, onClose }: CreateCampaignOverlayProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [maxStepReached, setMaxStepReached] = useState(1)
  const [draft, setDraft] = useState<CampaignDraft>({ goal: null, selectedCoaches: [], templates: [] })

  const goToStep = (step: number) => {
    setCurrentStep(step)
    setMaxStepReached((prev) => Math.max(prev, step))
  }

  const handleGoalSelect = (goal: CampaignGoal) => {
    setDraft((prev) => ({ ...prev, goal }))
    goToStep(2)
  }

  return (
    <div className="animate-in slide-in-from-right-8 fade-in fixed inset-0 z-[60] overflow-y-auto duration-300">
      {/* Dimmed backdrop */}
      <div
        className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
        onClick={onClose}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        role="button"
        tabIndex={0}
        aria-label="Close campaign builder"
      />

      {/* Slide-in panel */}
      <div className="absolute inset-y-0 right-0 flex w-full max-w-5xl flex-col bg-background shadow-2xl sm:rounded-l-2xl overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-card shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 lg:px-8">
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
        <div className="mx-auto max-w-7xl px-4 pb-4 lg:px-8">
          <div className="flex items-center gap-0">
            {STEPS.map((step, i) => {
              const canNavigate = step.number <= maxStepReached
              return (
                <div key={step.number} className="flex flex-1 items-center">
                  <button
                    type="button"
                    disabled={!canNavigate}
                    onClick={() => canNavigate && goToStep(step.number)}
                    className={`flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors ${
                      canNavigate ? "cursor-pointer hover:bg-secondary/80" : "cursor-default"
                    }`}
                  >
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
                  </button>
                  {i < STEPS.length - 1 && (
                    <div
                      className={`mx-3 h-0.5 flex-1 rounded-full transition-colors ${
                        currentStep > step.number ? "bg-primary" : "bg-border"
                      }`}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
        {currentStep === 1 && (
          <GoalStep onSelect={handleGoalSelect} selected={draft.goal} />
        )}

        {currentStep === 2 && (
          <TargetStep
            programs={programs}
            playerPosition={playerPosition}
            selectedCoaches={draft.selectedCoaches}
            onCoachesChange={(coaches) => setDraft((prev) => ({ ...prev, selectedCoaches: coaches }))}
            onNext={() => goToStep(3)}
            onBack={() => goToStep(1)}
          />
        )}

        {currentStep === 3 && draft.goal && (
          <BuildStep
            goal={draft.goal}
            templates={draft.templates}
            onTemplatesChange={(templates) => setDraft((prev) => ({ ...prev, templates }))}
            onNext={() => goToStep(4)}
            onBack={() => goToStep(2)}
          />
        )}

        {currentStep === 4 && draft.goal && (
          <LaunchStep
            goal={draft.goal}
            selectedCoaches={draft.selectedCoaches}
            templates={draft.templates}
            onEditTarget={() => goToStep(2)}
            onEditBuild={() => goToStep(3)}
            onBack={() => goToStep(3)}
          />
        )}
      </div>
      </div>
    </div>
  )
}
