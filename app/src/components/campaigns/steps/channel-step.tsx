"use client"

import { Mail, MessageCircle } from "lucide-react"
import type { CampaignType } from "../types"

interface ChannelStepProps {
  onSelect: (type: CampaignType) => void
  selected: CampaignType | null
}

const CHANNELS: {
  id: CampaignType
  icon: typeof Mail
  title: string
  highlight: string
  description: string
}[] = [
  {
    id: "email",
    icon: Mail,
    title: "Send emails to coaches with",
    highlight: "EMAIL CAMPAIGN",
    description:
      "Build a multi-step email sequence with personalized merge tags. Emails are sent automatically via Gmail.",
  },
  {
    id: "dm",
    icon: MessageCircle,
    title: "Reach coaches on X with",
    highlight: "DM ASSIST",
    description:
      "We'll personalize your messages and queue them up. You copy, open X, paste, and send — 10x faster than doing it yourself.",
  },
]

export function ChannelStep({ onSelect, selected }: ChannelStepProps) {
  return (
    <div>
      <h2 className="mb-2 font-display text-base font-bold uppercase tracking-wider text-foreground">
        Choose your channel
      </h2>
      <p className="mb-8 text-sm text-muted-foreground">
        How do you want to reach out to coaches?
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:max-w-3xl">
        {CHANNELS.map((channel) => {
          const Icon = channel.icon
          const isSelected = selected === channel.id
          return (
            <button
              key={channel.id}
              type="button"
              onClick={() => onSelect(channel.id)}
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
              <p className="text-sm text-muted-foreground">{channel.title}</p>
              <p className="mt-1 font-display text-base font-bold uppercase tracking-wider text-foreground">
                {channel.highlight}
              </p>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                {channel.description}
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
