"use client"

import { Mail, Film, Heart, MapPin } from "lucide-react"
import type { CampaignGoal } from "../types"

const GOALS: {
  id: CampaignGoal
  icon: typeof Mail
  title: string
  highlight: string
  description: string
  color: string
}[] = [
  {
    id: "get_response",
    icon: Mail,
    title: "Initiate contact to",
    highlight: "GET A RESPONSE",
    description: "Send your first email to coaches who don't know you yet. Start the conversation and get on their radar.",
    color: "primary",
  },
  {
    id: "evaluate_film",
    icon: Film,
    title: "Get them to",
    highlight: "EVALUATE YOUR FILM",
    description: "Share your highlight reel and game film. Get coaches to watch and assess your abilities.",
    color: "primary",
  },
  {
    id: "build_interest",
    icon: Heart,
    title: "Share your story to",
    highlight: "BUILD INTEREST",
    description: "Go beyond stats. Share your academics, character, and what makes you a great fit for their program.",
    color: "primary",
  },
  {
    id: "secure_visit",
    icon: MapPin,
    title: "Discuss the details and",
    highlight: "SECURE A VISIT",
    description: "You've built a connection. Now lock in a campus visit, virtual meeting, or tryout opportunity.",
    color: "primary",
  },
]

interface GoalStepProps {
  onSelect: (goal: CampaignGoal) => void
  selected: CampaignGoal | null
}

export function GoalStep({ onSelect, selected }: GoalStepProps) {
  return (
    <div>
      <h2 className="mb-2 font-display text-base font-bold uppercase tracking-wider text-foreground">
        What&apos;s your goal?
      </h2>
      <p className="mb-8 text-sm text-muted-foreground">
        Choose the objective for this email campaign. This determines your templates and strategy.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {GOALS.map((goal) => {
          const Icon = goal.icon
          const isSelected = selected === goal.id
          return (
            <button
              key={goal.id}
              type="button"
              onClick={() => onSelect(goal.id)}
              className={`group flex flex-col items-center rounded-xl border-2 p-6 text-center transition-all hover:shadow-lg ${
                isSelected
                  ? "border-primary bg-primary/[0.03] shadow-md"
                  : "border-border bg-card hover:border-primary/30"
              }`}
            >
              <div
                className={`mb-4 flex h-14 w-14 items-center justify-center rounded-xl transition-colors ${
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-primary/10 text-primary group-hover:bg-primary/20"
                }`}
              >
                <Icon className="h-7 w-7" />
              </div>
              <p className="text-sm text-muted-foreground">{goal.title}</p>
              <p className="mt-1 font-display text-base font-bold uppercase tracking-wider text-foreground">
                {goal.highlight}
              </p>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                {goal.description}
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
