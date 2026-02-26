"use client"

import { CalendarDays, Flame, Users } from "lucide-react"
import { PlayerSwitcher } from "@/components/coach/PlayerSwitcher"

interface HubHeaderProps {
  firstName: string
  isCoach?: boolean
  activePlayerName?: string | null
}

export function HubHeader({ firstName, isCoach = false, activePlayerName }: HubHeaderProps) {
  const now = new Date()
  const hour = now.getHours()
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
  const formattedDate = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <div className="flex flex-col gap-2">
      {/* Top row: greeting + player switcher (coach) or date (athlete) */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-foreground sm:text-3xl">
          {greeting}, {firstName}
        </h1>
        {isCoach ? (
          <PlayerSwitcher />
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            {formattedDate}
          </div>
        )}
      </div>
      {/* Subtitle row */}
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {isCoach ? (
            <>
              <Users className="h-3.5 w-3.5 text-accent" />
              {activePlayerName
                ? `MANAGING ${activePlayerName.toUpperCase()}'S RECRUITING`
                : "SELECT A PLAYER TO GET STARTED"}
            </>
          ) : (
            <>
              <Flame className="h-3.5 w-3.5 text-accent" />
              COACHES ARE WATCHING. MAKE EVERY POST COUNT.
            </>
          )}
        </p>
        {isCoach && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            {formattedDate}
          </div>
        )}
      </div>
    </div>
  )
}
