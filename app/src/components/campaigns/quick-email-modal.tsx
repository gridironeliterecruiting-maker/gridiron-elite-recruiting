"use client"

import { useState } from "react"
import { X, Mail, Film, Heart, MapPin, MessageSquare } from "lucide-react"
import type { CampaignGoal } from "./types"

interface QuickEmailModalProps {
  coach: {
    id: string
    first_name: string
    last_name: string
    title: string
    school_name: string
  }
  onContinue: (goal: CampaignGoal) => void
  onClose: () => void
}

const GOALS: {
  id: CampaignGoal
  icon: typeof Mail
  label: string
  description: string
}[] = [
  {
    id: "get_response",
    icon: Mail,
    label: "Get a Response",
    description: "Start the conversation"
  },
  {
    id: "evaluate_film",
    icon: Film,
    label: "Evaluate Film",
    description: "Share your highlights"
  },
  {
    id: "build_interest",
    icon: Heart,
    label: "Build Interest",
    description: "Share your story"
  },
  {
    id: "secure_visit",
    icon: MapPin,
    label: "Secure Visit",
    description: "Schedule a meeting"
  },
  {
    id: "other",
    icon: MessageSquare,
    label: "Other",
    description: "Custom message"
  }
]

export function QuickEmailModal({ coach, onContinue, onClose }: QuickEmailModalProps) {
  const [selectedGoal, setSelectedGoal] = useState<CampaignGoal | null>(null)

  const handleContinue = () => {
    if (selectedGoal) {
      onContinue(selectedGoal)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative mx-4 w-full max-w-md rounded-xl bg-card p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h3 className="font-display text-lg font-bold uppercase tracking-tight text-foreground">
              Email {coach.first_name} {coach.last_name}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {coach.title} • {coach.school_name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-secondary text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Goal Selection */}
        <div className="mb-6">
          <p className="mb-4 text-sm text-muted-foreground">What's your goal with this email?</p>
          <div className="space-y-2">
            {GOALS.map((goal) => {
              const Icon = goal.icon
              const isSelected = selectedGoal === goal.id
              return (
                <button
                  key={goal.id}
                  type="button"
                  onClick={() => setSelectedGoal(goal.id)}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                    isSelected
                      ? "border-primary bg-primary/[0.03]"
                      : "border-border bg-card hover:border-primary/20"
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors ${
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">{goal.label}</p>
                    <p className="text-xs text-muted-foreground">{goal.description}</p>
                  </div>
                  <div
                    className={`h-5 w-5 shrink-0 rounded-full border-2 transition-colors ${
                      isSelected
                        ? "border-primary bg-primary"
                        : "border-border"
                    }`}
                  >
                    {isSelected && (
                      <div className="h-full w-full rounded-full bg-primary-foreground scale-50" />
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Continue Button */}
        <button
          type="button"
          onClick={handleContinue}
          disabled={!selectedGoal}
          className="w-full rounded-md bg-primary py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continue →
        </button>
      </div>
    </div>
  )
}