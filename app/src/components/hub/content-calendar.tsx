"use client"

import { useState, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, Copy, ChevronLeft, ChevronRight } from "lucide-react"

interface AthleteProfile {
  first_name: string | null
  last_name: string | null
  position: string | null
  grad_year: number | null
  high_school: string | null
  hudl_url: string | null
  city: string | null
  state: string | null
}

interface ContentCalendarProps {
  profile: AthleteProfile
}

interface DayPlan {
  day: string
  shortDay: string
  type: string
  description: string
  icon: string
  template: string
  color: string
}

function getSeasonalGuidance(): { season: string; tip: string } {
  const month = new Date().getMonth() + 1
  if (month >= 3 && month <= 5) return { season: "Spring", tip: "Camp season — post about camps you're attending, combine numbers, and spring eval visits." }
  if (month >= 6 && month <= 7) return { season: "Summer", tip: "Showcase season — highlight 7-on-7, showcases, and unofficial visits." }
  if (month >= 8 && month <= 11) return { season: "Fall", tip: "Game season — weekly film drops, highlight clips, and stat lines." }
  return { season: "Winter", tip: "Signing period — commitment posts, early signing day content, and off-season training." }
}

const weekPlan: DayPlan[] = [
  {
    day: "Monday",
    shortDay: "Mon",
    type: "Training / Work Ethic",
    description: "Weight room, speed work, drills",
    icon: "💪",
    template: "Started the week grinding. ((Position)) work is never done.\n\nSpeed. Strength. Film.\n\n#((Position))Recruiting #Classof((Grad Year)) #CollegeFootball",
    color: "bg-blue-50 border-blue-200 text-blue-700",
  },
  {
    day: "Tuesday",
    shortDay: "Tue",
    type: "Coach Engagement",
    description: "Like/reply to coaches in your pipeline",
    icon: "🤝",
    template: "Engage with 2-3 coaches from your target list today. Like their posts, reply to their content, and show genuine interest in their program.",
    color: "bg-green-50 border-green-200 text-green-700",
  },
  {
    day: "Wednesday",
    shortDay: "Wed",
    type: "Academic / Character",
    description: "GPA, community service, leadership",
    icon: "📚",
    template: "It's not just about what happens on the field. Proud to carry a ((GPA)) GPA at ((High School)).\n\nStudent-athlete. Always.\n\n#StudentAthlete #Classof((Grad Year))",
    color: "bg-purple-50 border-purple-200 text-purple-700",
  },
  {
    day: "Thursday",
    shortDay: "Thu",
    type: "Film / Highlight",
    description: "Specific play with self-analysis",
    icon: "🎬",
    template: "Breaking down my film 🎥\n\nWorking on my technique every day. Watch how I ((specific skill)).\n\n((Film Link))\n\n#((Position))Recruiting #Classof((Grad Year)) #CollegeFootball",
    color: "bg-amber-50 border-amber-200 text-amber-700",
  },
  {
    day: "Friday",
    shortDay: "Fri",
    type: "Recruiting Engagement",
    description: "Retweet a target program, comment on their content",
    icon: "🏈",
    template: "Retweet or quote-tweet something from a program you're targeting. Add a genuine comment about why you respect their program.",
    color: "bg-red-50 border-red-200 text-red-700",
  },
  {
    day: "Saturday",
    shortDay: "Sat",
    type: "Game Day Content",
    description: "Pre-game hype or post-game reflection",
    icon: "🏟️",
    template: "Game day at ((High School)) 🏟️\n\nTime to put the work on display.\n\n#FridayNightLights #((Position)) #Classof((Grad Year))",
    color: "bg-orange-50 border-orange-200 text-orange-700",
  },
  {
    day: "Sunday",
    shortDay: "Sun",
    type: "Weekly Reflection",
    description: "What you worked on, what's next",
    icon: "📝",
    template: "Week in review:\n\n✅ What went well this week\n🎯 What I'm improving next week\n\nAlways getting better. ((City)), ((State)) ➡️ College\n\n#RecruitMe #((Position)) #Classof((Grad Year))",
    color: "bg-teal-50 border-teal-200 text-teal-700",
  },
]

function resolveTemplate(template: string, profile: AthleteProfile): string {
  return template
    .replace(/\(\(Position\)\)/g, profile.position || "[Position]")
    .replace(/\(\(Grad Year\)\)/g, String(profile.grad_year || "[Year]"))
    .replace(/\(\(High School\)\)/g, profile.high_school || "[School]")
    .replace(/\(\(Film Link\)\)/g, profile.hudl_url || "[Your Hudl Link]")
    .replace(/\(\(GPA\)\)/g, "[GPA]")
    .replace(/\(\(City\)\)/g, profile.city || "[City]")
    .replace(/\(\(State\)\)/g, profile.state || "[State]")
    .replace(/\(\(First Name\)\)/g, profile.first_name || "[Name]")
}

export function ContentCalendar({ profile }: ContentCalendarProps) {
  const today = new Date().getDay() // 0 = Sunday
  const todayIndex = today === 0 ? 6 : today - 1 // Convert to Mon=0 index
  const [selectedDay, setSelectedDay] = useState(todayIndex)
  const [copiedDay, setCopiedDay] = useState<number | null>(null)

  const seasonal = getSeasonalGuidance()
  const selectedPlan = weekPlan[selectedDay]
  const resolvedTemplate = resolveTemplate(selectedPlan.template, profile)

  const handleCopy = async (dayIndex: number) => {
    const text = resolveTemplate(weekPlan[dayIndex].template, profile)
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const textarea = document.createElement("textarea")
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand("copy")
      document.body.removeChild(textarea)
    }
    setCopiedDay(dayIndex)
    setTimeout(() => setCopiedDay(null), 2000)
  }

  return (
    <Card className="overflow-hidden">
      <div className="p-5 sm:p-6">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">
            Weekly Content Calendar
          </h3>
          <Badge className="border-0 bg-primary/10 text-primary text-[10px] font-bold">
            {seasonal.season}
          </Badge>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">{seasonal.tip}</p>

        {/* Day selector */}
        <div className="mb-4 grid grid-cols-7 gap-1">
          {weekPlan.map((day, i) => {
            const isToday = i === todayIndex
            const isSelected = i === selectedDay
            return (
              <button
                key={day.day}
                type="button"
                onClick={() => setSelectedDay(i)}
                className={`flex flex-col items-center rounded-lg px-1 py-2 text-center transition-all ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : isToday
                      ? "bg-primary/10 text-primary hover:bg-primary/20"
                      : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                }`}
              >
                <span className="text-[10px] font-bold uppercase">{day.shortDay}</span>
                <span className="mt-0.5 text-sm">{day.icon}</span>
              </button>
            )
          })}
        </div>

        {/* Selected day content */}
        <div className={`rounded-lg border p-4 ${selectedPlan.color}`}>
          <div className="mb-2 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider">{selectedPlan.day}</p>
              <p className="text-sm font-semibold">{selectedPlan.type}</p>
            </div>
            <span className="text-2xl">{selectedPlan.icon}</span>
          </div>
          <p className="mb-3 text-xs opacity-80">{selectedPlan.description}</p>

          {/* Caption template */}
          <div className="rounded-md bg-white/80 p-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Caption Template
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {resolvedTemplate}
            </p>
          </div>

          <button
            type="button"
            onClick={() => handleCopy(selectedDay)}
            className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-bold transition-colors ${
              copiedDay === selectedDay
                ? "bg-green-600 text-white"
                : "bg-foreground/90 text-background hover:bg-foreground"
            }`}
          >
            {copiedDay === selectedDay ? (
              <><Check className="h-3 w-3" /> Copied!</>
            ) : (
              <><Copy className="h-3 w-3" /> Copy Caption</>
            )}
          </button>
        </div>
      </div>
    </Card>
  )
}
