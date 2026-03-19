import { CalendarDays } from "lucide-react"

export function WelcomeHeader() {
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
    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-foreground sm:text-3xl">
          {greeting}, Paul
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          YOUR RECRUITING OVERVIEW AT A GLANCE
        </p>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CalendarDays className="h-3.5 w-3.5" />
        {formattedDate}
      </div>
    </div>
  )
}
