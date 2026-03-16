"use client"

import { useState, useEffect, useCallback } from "react"
import { X, Check, Loader2 } from "lucide-react"
import { useActivePlayer, type PlayerInfo } from "@/components/ActivePlayerContext"

interface MyPlayersOverlayProps {
  onClose: () => void
}

export function MyPlayersOverlay({ onClose }: MyPlayersOverlayProps) {
  const { players, activePlayer, setActivePlayer } = useActivePlayer()
  const [visible, setVisible] = useState(false)
  const [switching, setSwitching] = useState<string | null>(null)

  // Animate in on mount
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  // Close with animation
  const handleClose = useCallback(() => {
    setVisible(false)
    setTimeout(onClose, 200)
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [handleClose])

  const handleSelect = (player: PlayerInfo) => {
    if (player.id === activePlayer?.id) {
      handleClose()
      return
    }
    setSwitching(player.id)
    // Small delay so the user sees feedback before the page reloads
    setTimeout(() => setActivePlayer(player.id), 150)
  }

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center transition-colors duration-200 ${
        visible ? "bg-black/50" : "bg-black/0"
      }`}
      onClick={handleClose}
    >
      <div
        className={`relative mx-4 w-full max-w-md rounded-xl bg-card shadow-2xl ring-1 ring-border transition-all duration-200 ${
          visible
            ? "scale-100 opacity-100"
            : "scale-95 opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="font-display text-lg font-bold uppercase tracking-tight">My Players</h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-secondary hover:text-foreground"
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
                const isSwitching = switching === player.id
                return (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => handleSelect(player)}
                    disabled={!!switching}
                    className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all duration-150 ${
                      isSwitching
                        ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                        : isActive
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "border-border hover:border-primary/30 hover:bg-secondary/50 hover:shadow-sm active:scale-[0.99]"
                    } ${switching && !isSwitching ? "opacity-50" : ""}`}
                  >
                    {/* Initials avatar */}
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors duration-150 ${
                      isActive || isSwitching ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
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

                    {/* Active indicator or loading spinner */}
                    {isSwitching ? (
                      <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
                    ) : isActive ? (
                      <Check className="h-5 w-5 shrink-0 text-primary" />
                    ) : null}
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
