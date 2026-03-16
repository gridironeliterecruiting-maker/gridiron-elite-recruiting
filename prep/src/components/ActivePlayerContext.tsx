'use client'

import { createContext, useContext } from 'react'

export type PlayerInfo = {
  id: string
  first_name: string
  last_name: string
  position: string | null
  grad_year: number | null
  high_school: string | null
}

interface ActivePlayerContextType {
  activePlayer: PlayerInfo | null
  players: PlayerInfo[]
  isCoach: boolean
  setActivePlayer: (id: string) => void
}

const ActivePlayerContext = createContext<ActivePlayerContextType>({
  activePlayer: null,
  players: [],
  isCoach: false,
  setActivePlayer: () => {},
})

export function ActivePlayerProvider({ children }: { children: React.ReactNode }) {
  return (
    <ActivePlayerContext.Provider value={{ activePlayer: null, players: [], isCoach: false, setActivePlayer: () => {} }}>
      {children}
    </ActivePlayerContext.Provider>
  )
}

export function useActivePlayer() {
  return useContext(ActivePlayerContext)
}
