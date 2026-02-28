"use client"

import { useMemo, useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Check, X as XIcon, AlertCircle, ChevronDown, Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

const DISMISSED_KEY = "readiness_score_dismissed"

interface TwitterProfile {
  username: string
  name: string
  description: string
  profileImageUrl: string | null
  followersCount: number
  followingCount: number
  tweetCount: number
  isProtected: boolean
  pinnedTweet: {
    text: string
    hasMedia: boolean
    createdAt: string
  } | null
  lastTweetAt: string | null
}

interface AthleteProfile {
  first_name: string | null
  last_name: string | null
  position: string | null
  grad_year: number | null
  high_school: string | null
  hudl_url: string | null
}

interface ReadinessScoreProps {
  twitterProfile: TwitterProfile | null
  athleteProfile: AthleteProfile
  defaultOpen: boolean
}

interface CheckItem {
  label: string
  points: number
  passed: boolean
  fix: string
}

export function ReadinessScore({ twitterProfile, athleteProfile, defaultOpen }: ReadinessScoreProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISSED_KEY) === "true")
  }, [])

  const toggleOpen = async () => {
    const next = !isOpen
    setIsOpen(next)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      supabase.from("profiles").update({ readiness_score_open: next }).eq("id", user.id)
    }
  }

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true")
    setDismissed(true)
  }

  const checks = useMemo((): CheckItem[] => {
    if (!twitterProfile) return []

    const bio = twitterProfile.description || ""
    const name = twitterProfile.name || ""
    const handle = twitterProfile.username || ""
    const fullName = `${athleteProfile.first_name || ""} ${athleteProfile.last_name || ""}`.trim().toLowerCase()
    const firstName = (athleteProfile.first_name || "").toLowerCase()
    const lastName = (athleteProfile.last_name || "").toLowerCase()

    // Check if real name appears in handle or display name
    const nameInProfile =
      name.toLowerCase().includes(firstName) ||
      name.toLowerCase().includes(lastName) ||
      handle.toLowerCase().includes(firstName) ||
      handle.toLowerCase().includes(lastName)

    // Check bio content
    const positionInBio = athleteProfile.position
      ? bio.toLowerCase().includes(athleteProfile.position.toLowerCase()) ||
        bio.match(/\b(QB|RB|WR|TE|OL|DL|DE|DT|LB|CB|S|K|P|ATH|OT|OG|C|FS|SS|ILB|OLB|NT)\b/i) !== null
      : false

    const gradYearInBio = athleteProfile.grad_year
      ? bio.includes(String(athleteProfile.grad_year)) || bio.includes(`'${String(athleteProfile.grad_year).slice(2)}`)
      : false

    const schoolInBio = athleteProfile.high_school
      ? bio.toLowerCase().includes(athleteProfile.high_school.toLowerCase())
      : false

    const hasLinkInBio =
      bio.match(/hudl|highlight|film|youtube|youtu\.be|bit\.ly|linktr/i) !== null ||
      (twitterProfile as any).url != null

    const hasProfilePhoto = twitterProfile.profileImageUrl != null && !twitterProfile.profileImageUrl.includes("default_profile")

    const hasPinnedTweet = twitterProfile.pinnedTweet != null
    const pinnedHasMedia = twitterProfile.pinnedTweet?.hasMedia || false

    const isPublic = !twitterProfile.isProtected

    const lastTweetDate = twitterProfile.lastTweetAt ? new Date(twitterProfile.lastTweetAt) : null
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recentlyPosted = lastTweetDate ? lastTweetDate > sevenDaysAgo : false

    return [
      {
        label: "Real name in handle or display name",
        points: 10,
        passed: nameInProfile,
        fix: `Update your X display name to include "${athleteProfile.first_name} ${athleteProfile.last_name}"`,
      },
      {
        label: "Position in bio",
        points: 10,
        passed: positionInBio,
        fix: `Add "${athleteProfile.position}" to your X bio`,
      },
      {
        label: "Grad year in bio",
        points: 10,
        passed: gradYearInBio,
        fix: `Add "Class of ${athleteProfile.grad_year}" or "'${String(athleteProfile.grad_year || "").slice(2)}" to your bio`,
      },
      {
        label: "High school in bio",
        points: 10,
        passed: schoolInBio,
        fix: `Add "${athleteProfile.high_school}" to your X bio`,
      },
      {
        label: "Hudl or highlight link in bio",
        points: 15,
        passed: hasLinkInBio,
        fix: "Add your Hudl link to your X bio or website field",
      },
      {
        label: "Profile photo set",
        points: 10,
        passed: hasProfilePhoto,
        fix: "Upload a professional profile photo (headshot or action shot)",
      },
      {
        label: "Pinned tweet exists",
        points: 10,
        passed: hasPinnedTweet,
        fix: "Pin your best highlight reel or recruiting intro tweet",
      },
      {
        label: "Pinned tweet has video or link",
        points: 10,
        passed: pinnedHasMedia,
        fix: "Make sure your pinned tweet includes a highlight video or Hudl link",
      },
      {
        label: "Account is public",
        points: 10,
        passed: isPublic,
        fix: "Switch your X account to public so coaches can see your content",
      },
      {
        label: "Posted in last 7 days",
        points: 5,
        passed: recentlyPosted,
        fix: "Post at least once a week to show coaches you're active",
      },
    ]
  }, [twitterProfile, athleteProfile])

  const score = useMemo(() => checks.reduce((sum, c) => sum + (c.passed ? c.points : 0), 0), [checks])
  const maxScore = 100

  const scoreColor =
    score >= 71 ? "text-green-500" : score >= 41 ? "text-amber-500" : "text-red-500"
  const ringColor =
    score >= 71 ? "stroke-green-500" : score >= 41 ? "stroke-amber-500" : "stroke-red-500"
  const scoreLabel =
    score >= 71 ? "Coach-Ready" : score >= 41 ? "Getting There" : "Not Recruiting-Ready"
  const scoreBg =
    score >= 71 ? "bg-green-50 border-green-200" : score >= 41 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200"

  // SVG ring calculations
  const radius = 58
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / maxScore) * circumference

  const failingChecks = checks.filter(c => !c.passed)
  const passingChecks = checks.filter(c => c.passed)

  if (!twitterProfile || dismissed) {
    return null
  }

  return (
    <Card className="overflow-hidden">
      <button
        onClick={toggleOpen}
        className="flex w-full items-center justify-between px-5 py-4 sm:px-6"
      >
        <h3 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wider text-foreground">
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-black font-black text-white" style={{ fontSize: 11 }}>X</span>
          Recruiting Readiness Score
          {!isOpen && (
            <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-bold tabular-nums ${scoreBg} ${scoreColor}`}>
              {score}
            </span>
          )}
        </h3>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
      <div className="px-5 pb-5 sm:px-6 sm:pb-6">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          {/* Score Ring */}
          <div className="relative flex shrink-0 items-center justify-center">
            <svg width="140" height="140" viewBox="0 0 140 140">
              <circle
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                className="text-secondary"
              />
              <circle
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                className={`${ringColor} transition-all duration-1000`}
                transform="rotate(-90 70 70)"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`font-display text-3xl font-bold ${scoreColor}`}>{score}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                / {maxScore}
              </span>
            </div>
          </div>

          <div className="flex-1">
            {/* Status Badge */}
            <div className={`mb-4 inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-bold ${scoreBg}`}>
              <AlertCircle className="h-3.5 w-3.5" />
              {scoreLabel}
            </div>

            {/* Failing items (action list) */}
            {failingChecks.length > 0 && (
              <div className="mb-3 flex flex-col gap-2">
                {failingChecks.map((check) => (
                  <div key={check.label} className="flex items-start gap-2">
                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100">
                      <XIcon className="h-3 w-3 text-red-500" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">{check.label}</p>
                      <p className="text-[11px] text-muted-foreground">{check.fix}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Passing items (collapsed) */}
            {passingChecks.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {passingChecks.map((check) => (
                  <div
                    key={check.label}
                    className="flex items-center gap-1 rounded-md bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700"
                  >
                    <Check className="h-3 w-3" />
                    {check.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Dismiss — only available once score is coach-ready */}
        {score >= 70 && (
          <div className="mt-4 flex justify-end border-t border-border pt-4">
            <button
              onClick={handleDismiss}
              className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Dismiss this card
            </button>
          </div>
        )}
      </div>
      )}
    </Card>
  )
}
