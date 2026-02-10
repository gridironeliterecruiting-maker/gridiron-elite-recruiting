"use client"

import { useEffect, useRef } from "react"
import { Trophy } from "lucide-react"

const tickerItems = [
  "NCAA D1 Early Signing Period: Dec 18-20",
  "D2/D3 Signing Day: Feb 5",
  "Spring Evaluation Period Opens: Apr 15",
  "Gridiron Elite Tip: Update your highlight reel monthly",
  "10 programs tracked across 3 conferences",
]

export function RecruitingTicker() {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    let animationId: number
    let position = 0

    const animate = () => {
      position -= 0.5
      if (position <= -(el.scrollWidth / 2)) {
        position = 0
      }
      el.style.transform = `translateX(${position}px)`
      animationId = requestAnimationFrame(animate)
    }

    animationId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationId)
  }, [])

  return (
    <div className="overflow-hidden bg-primary/5 border border-primary/10 rounded-lg">
      <div className="flex items-center">
        <div className="flex shrink-0 items-center gap-1.5 bg-primary px-3 py-2">
          <Trophy className="h-3.5 w-3.5 text-primary-foreground" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-primary-foreground">
            Updates
          </span>
        </div>
        <div className="relative flex-1 overflow-hidden py-2">
          <div ref={scrollRef} className="flex whitespace-nowrap">
            {[...tickerItems, ...tickerItems].map((item, i) => (
              <span
                key={`${item}-${i}`}
                className="mx-6 text-xs font-medium text-foreground/70"
              >
                {item}
                <span className="ml-6 text-accent">{"////"}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
