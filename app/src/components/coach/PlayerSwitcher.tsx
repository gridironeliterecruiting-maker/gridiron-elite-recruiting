"use client"

import { useState } from "react"
import { ChevronDown, UserCircle } from "lucide-react"
import { useActivePlayer } from "@/components/ActivePlayerContext"
import { MyPlayersOverlay } from "@/components/coach/MyPlayersOverlay"

export function PlayerSwitcher() {
  const [showOverlay, setShowOverlay] = useState(false)
  const { activePlayer, isCoach } = useActivePlayer()

  if (!isCoach || !activePlayer) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setShowOverlay(true)}
        className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-secondary/50"
      >
        <UserCircle className="h-4 w-4 text-primary" />
        {activePlayer.first_name} {activePlayer.last_name}
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {showOverlay && (
        <MyPlayersOverlay onClose={() => setShowOverlay(false)} />
      )}
    </>
  )
}
