"use client"

import { X, Check } from "lucide-react"
import { useActivePlayer, type PlayerInfo } from "@/components/ActivePlayerContext"

interface MyPlayersOverlayProps {
  onClose: () => void
}

export function MyPlayersOverlay({ onClose }: MyPlayersOverlayProps) {
  const { players, activePlayer, setActivePlayer } = useActivePlayer()

  const handleSelect = (player: PlayerInfo) => {
    if (player.id === activePlayer?.id) {
      onClose()
      return
    }
    setActivePlayer(player.id)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="relative mx-4 w-full max-w-md rounded-xl bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="font-display text-lg font-bold uppercase tracking-tight">My Players</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Player list */}
        <div className="max-h-96 overflow-y-auto p-4">
          {players.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No players assigned yet.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {players.map((player) => {
                const isActive = player.id === activePlayer?.id
                return (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => handleSelect(player)}
                    className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all ${
                      isActive
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-border hover:border-primary/30 hover:bg-muted/50"
                    }`}
                  >
                    {/* Initials avatar */}
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}>
                      {player.first_name?.[0]}{player.last_name?.[0]}
                    </div>

                    {/* Player info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">
                        {player.first_name} {player.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[player.position, player.grad_year ? `Class of ${player.grad_year}` : null, player.high_school]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>

                    {/* Active indicator */}
                    {isActive && (
                      <Check className="h-5 w-5 shrink-0 text-primary" />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
