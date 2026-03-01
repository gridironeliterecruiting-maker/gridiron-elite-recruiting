"use client"

import { Settings } from "lucide-react"
import { PlayerSwitcher } from "@/components/coach/PlayerSwitcher"

interface ProfileHeaderProps {
  isCoach: boolean
}

export function ProfileHeader({ isCoach }: ProfileHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-foreground sm:text-3xl">
          {isCoach ? "Coach Profile" : "Profile"}
        </h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Settings className="h-3.5 w-3.5 text-accent" />
          {isCoach ? "YOUR INFO & ACTIVE PLAYER DETAILS." : "MANAGE YOUR INFO THAT POWERS OUTREACH."}
        </p>
      </div>
      {isCoach && <PlayerSwitcher />}
    </div>
  )
}
