"use client"

import { createContext, useContext, useCallback } from "react"
import { setActivePlayerCookie } from "@/lib/active-player-client"

export interface PlayerInfo {
  id: string
  first_name: string
  last_name: string
  position: string | null
  grad_year: number | null
  high_school: string | null
}

interface ActivePlayerContextValue {
  activePlayer: PlayerInfo | null
  players: PlayerInfo[]
  isCoach: boolean
  setActivePlayer: (id: string) => void
}

const ActivePlayerContext = createContext<ActivePlayerContextValue>({
  activePlayer: null,
  players: [],
  isCoach: false,
  setActivePlayer: () => {},
})

interface ActivePlayerProviderProps {
  children: React.ReactNode
  activePlayer: PlayerInfo | null
  players: PlayerInfo[]
  isCoach: boolean
}

export function ActivePlayerProvider({
  children,
  activePlayer,
  players,
  isCoach,
}: ActivePlayerProviderProps) {
  const setActivePlayer = useCallback((id: string) => {
    setActivePlayerCookie(id)
    window.location.reload()
  }, [])

  return (
    <ActivePlayerContext.Provider value={{ activePlayer, players, isCoach, setActivePlayer }}>
      {children}
    </ActivePlayerContext.Provider>
  )
}

export function useActivePlayer() {
  return useContext(ActivePlayerContext)
}
