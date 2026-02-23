"use client"

import { useState, useEffect } from "react"
import { Suspense } from "react"
import { GmailTokenCaptureWrapper } from "@/components/gmail-token-capture-wrapper"
import { HubHeader } from "@/components/hub/hub-header"
import { TwitterProfileCard } from "@/components/hub/twitter-profile-card"
import { ReadinessScore } from "@/components/hub/readiness-score"
import { ContentCalendar } from "@/components/hub/content-calendar"
import { HubActionItems } from "@/components/hub/hub-action-items"
import { InstagramPlaceholder } from "@/components/hub/instagram-placeholder"

interface AthleteProfile {
  first_name: string | null
  last_name: string | null
  position: string | null
  grad_year: number | null
  high_school: string | null
  hudl_url: string | null
  city: string | null
  state: string | null
  twitter_handle: string | null
}

interface TwitterProfile {
  id: string
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

interface PipelineStage {
  name: string
  count: number
}

interface HubClientProps {
  profile: AthleteProfile
  hasTwitterToken: boolean
  pipelineCount: number
  stages: PipelineStage[]
  emailsSent: number
  dmsSent: number
  campaignCount: number
}

export function HubClient({
  profile,
  hasTwitterToken,
  pipelineCount,
  stages,
  emailsSent,
  dmsSent,
  campaignCount,
}: HubClientProps) {
  const [twitterProfile, setTwitterProfile] = useState<TwitterProfile | null>(null)
  const [twitterLoading, setTwitterLoading] = useState(hasTwitterToken)
  const [twitterError, setTwitterError] = useState<string | null>(null)

  // Fetch Twitter profile data client-side (requires API call with token refresh)
  useEffect(() => {
    if (!hasTwitterToken) return

    async function fetchTwitterProfile() {
      try {
        const res = await fetch("/api/twitter/profile")
        const data = await res.json()

        if (data.profile) {
          setTwitterProfile(data.profile)
        } else if (data.error) {
          setTwitterError(data.error)
        }
      } catch {
        setTwitterError("Failed to load Twitter profile")
      } finally {
        setTwitterLoading(false)
      }
    }

    fetchTwitterProfile()
  }, [hasTwitterToken])

  const handleConnectTwitter = () => {
    window.location.href = "/api/twitter/authorize"
  }

  const firstName = profile.first_name || "Athlete"

  return (
    <div className="flex flex-col gap-6">
      {/* Gmail token capture after OAuth redirect */}
      <Suspense fallback={null}>
        <GmailTokenCaptureWrapper />
      </Suspense>

      {/* Header with greeting and tagline */}
      <HubHeader firstName={firstName} />

      {/* Main layout: two-column on desktop */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left column — brand audit */}
        <div className="flex flex-col gap-6 lg:col-span-7">
          {/* Twitter profile card */}
          {twitterLoading ? (
            <TwitterProfileSkeleton />
          ) : (
            <TwitterProfileCard
              profile={twitterProfile}
              onConnect={handleConnectTwitter}
            />
          )}

          {/* Readiness score */}
          {twitterLoading ? (
            <ReadinessScoreSkeleton />
          ) : (
            <ReadinessScore
              twitterProfile={twitterProfile}
              athleteProfile={profile}
            />
          )}

          {/* Instagram placeholder */}
          <InstagramPlaceholder />
        </div>

        {/* Right column — content + actions */}
        <div className="flex flex-col gap-6 lg:col-span-5">
          {/* Content calendar */}
          <ContentCalendar profile={profile} />

          {/* Action items + outreach stats */}
          <HubActionItems
            pipelineCount={pipelineCount}
            stages={stages}
            emailsSent={emailsSent}
            dmsSent={dmsSent}
            campaignCount={campaignCount}
          />
        </div>
      </div>
    </div>
  )
}

function TwitterProfileSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border bg-card p-6">
      <div className="mb-4 h-3 w-48 rounded bg-secondary" />
      <div className="flex items-start gap-4">
        <div className="h-16 w-16 rounded-full bg-secondary" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 rounded bg-secondary" />
          <div className="h-3 w-24 rounded bg-secondary" />
          <div className="h-3 w-full rounded bg-secondary" />
          <div className="flex gap-4">
            <div className="h-3 w-20 rounded bg-secondary" />
            <div className="h-3 w-20 rounded bg-secondary" />
            <div className="h-3 w-20 rounded bg-secondary" />
          </div>
        </div>
      </div>
    </div>
  )
}

function ReadinessScoreSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border bg-card p-6">
      <div className="mb-4 h-3 w-48 rounded bg-secondary" />
      <div className="flex items-start gap-6">
        <div className="h-[140px] w-[140px] shrink-0 rounded-full bg-secondary" />
        <div className="flex-1 space-y-3">
          <div className="h-6 w-28 rounded bg-secondary" />
          <div className="h-4 w-full rounded bg-secondary" />
          <div className="h-4 w-3/4 rounded bg-secondary" />
          <div className="h-4 w-5/6 rounded bg-secondary" />
        </div>
      </div>
    </div>
  )
}
