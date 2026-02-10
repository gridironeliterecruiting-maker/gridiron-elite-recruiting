import { Card, CardContent } from "@/components/ui/card"
import {
  Building2,
  UserCheck,
  Send,
  Target,
  TrendingUp,
  TrendingDown,
} from "lucide-react"

const stats = [
  {
    label: "Programs in DB",
    value: 10,
    icon: Building2,
    trend: "+3 this week",
    trendUp: true,
    color: "primary" as const,
  },
  {
    label: "Coaches in DB",
    value: 13,
    icon: UserCheck,
    trend: "+5 this week",
    trendUp: true,
    color: "primary" as const,
  },
  {
    label: "Outreach Sent",
    value: 0,
    icon: Send,
    trend: "Get started",
    trendUp: false,
    color: "accent" as const,
  },
  {
    label: "In Pipeline",
    value: 0,
    icon: Target,
    trend: "Build pipeline",
    trendUp: false,
    color: "primary" as const,
  },
]

export function StatCards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card
          key={stat.label}
          className="group relative overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5"
        >
          {/* Top color stripe */}
          <div
            className={`absolute inset-x-0 top-0 h-1 ${
              stat.color === "accent" ? "bg-accent" : "bg-primary"
            }`}
          />

          <CardContent className="p-5 pt-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {stat.label}
                </p>
                <p className="mt-2 font-display text-4xl font-bold tracking-tight text-foreground">
                  {stat.value}
                </p>
              </div>
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${
                  stat.color === "accent"
                    ? "bg-accent/10 text-accent"
                    : "bg-primary/10 text-primary"
                }`}
              >
                <stat.icon className="h-5 w-5" />
              </div>
            </div>

            {/* Trend indicator */}
            <div className="mt-3 flex items-center gap-1.5">
              {stat.trendUp ? (
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span
                className={`text-xs font-medium ${
                  stat.trendUp ? "text-emerald-600" : "text-muted-foreground"
                }`}
              >
                {stat.trend}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
