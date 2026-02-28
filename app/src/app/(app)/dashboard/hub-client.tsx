"use client"

import { useState, useEffect } from "react"
import { Suspense } from "react"
import { GmailTokenCaptureWrapper } from "@/components/gmail-token-capture-wrapper"
import { HubHeader } from "@/components/hub/hub-header"
import { TwitterProfileCard } from "@/components/hub/twitter-profile-card"
import { ReadinessScore } from "@/components/hub/readiness-score"
import { ContentCalendar } from "@/components/hub/content-calendar"
import { HubActionItems } from "@/components/hub/hub-action-items"
import { CoachTwitterCard } from "@/components/hub/coach-twitter-card"
import { InstagramPlaceholder } from "@/components/hub/instagram-placeholder"
import { TargetSchoolsX, type PipelineProgram } from "@/components/hub/target-schools-x"
import { AccessRequestBanner, type PendingRequest } from "@/components/hub/access-request-banner"
import { TeamTwitterConnect } from "@/components/hub/team-twitter-connect"

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
  isCoach?: boolean
  coachFirstName?: string
  coachProgramName?: string | null
  activePlayerId?: string | null
  activePlayerName?: string | null
  hasTwitterToken: boolean
  twitterHandle: string | null
  playerHasTwitterToken?: boolean
  playerTwitterHandle?: string | null
  pipelineCount: number
  stages: PipelineStage[]
  emailsSent: number
  dmsSent: number
  campaignCount: number
  pipelinePrograms: PipelineProgram[]
  pendingAccessRequests: PendingRequest[]
  managedProgramId: string | null
  programTwitterHandle: string | null
}

export function HubClient({
  profile,
  isCoach = false,
  coachFirstName,
  coachProgramName,
  activePlayerId,
  activePlayerName,
  hasTwitterToken,
  twitterHandle,
  playerHasTwitterToken = false,
  playerTwitterHandle,
  pipelineCount,
  stages,
  emailsSent,
  dmsSent,
  campaignCount,
  pipelinePrograms,
  pendingAccessRequests,
  managedProgramId,
  programTwitterHandle,
}: HubClientProps) {
  const [twitterProfile, setTwitterProfile] = useState<TwitterProfile | null>(null)
  const [twitterLoading, setTwitterLoading] = useState(hasTwitterToken)

  // Fetch full Twitter profile data client-side (enrichment from Twitter API)
  useEffect(() => {
    if (!hasTwitterToken) return

    let cancelled = false

    async function fetchWithRetry() {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await fetch("/api/twitter/profile")
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const data = await res.json()

          if (!cancelled && data.profile) {
            setTwitterProfile(data.profile)
            setTwitterLoading(false)
            return
          }
        } catch {
          // Retry after a short delay
          if (attempt === 0) {
            await new Promise(r => setTimeout(r, 2000))
          }
        }
      }
      // Both attempts failed — stop loading, fallback to DB data
      if (!cancelled) setTwitterLoading(false)
    }

    fetchWithRetry()
    return () => { cancelled = true }
  }, [hasTwitterToken])

  const handleConnectTwitter = () => {
    const basePath = window.location.pathname.split('/').slice(0, -1).join('/') || ''
    window.location.href = `/api/twitter/authorize?returnTo=${basePath}/dashboard`
  }

  const firstName = isCoach && coachFirstName ? coachFirstName : (profile.first_name || "Athlete")

  return (
    <div className="flex flex-col gap-6">
      {/* Gmail token capture after OAuth redirect */}
      <Suspense fallback={null}>
        <GmailTokenCaptureWrapper />
      </Suspense>

      {/* Header with greeting and tagline */}
      <HubHeader
        firstName={firstName}
        isCoach={isCoach}
        activePlayerName={activePlayerName}
      />

      {/* Pending access request banners — coaches only */}
      {isCoach && pendingAccessRequests.length > 0 && coachProgramName && (
        <AccessRequestBanner
          requests={pendingAccessRequests}
          programName={coachProgramName}
        />
      )}

      {/* Main layout: two-column on desktop */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left column — brand audit (athletes) or action items (coaches) */}
        <div className="flex flex-col gap-6 lg:col-span-7">
          {!isCoach && (
            <>
              {/* Twitter profile card */}
              {twitterLoading ? (
                <TwitterProfileSkeleton />
              ) : (
                <TwitterProfileCard
                  profile={twitterProfile}
                  handle={twitterHandle}
                  onConnect={handleConnectTwitter}
                />
              )}

              {/* Readiness score — only shown when full profile is available */}
              {twitterLoading ? (
                twitterProfile || hasTwitterToken ? <ReadinessScoreSkeleton /> : null
              ) : twitterProfile ? (
                <ReadinessScore
                  twitterProfile={twitterProfile}
                  athleteProfile={profile}
                />
              ) : null}

              {/* Engage Target Schools on X */}
              <TargetSchoolsX programs={pipelinePrograms} />

              {/* Instagram placeholder */}
              <InstagramPlaceholder />
            </>
          )}

          {isCoach && (
            <>
              {/* Player's Twitter profile card */}
              {(playerHasTwitterToken || playerTwitterHandle) && activePlayerId && (
                <CoachTwitterCard
                  playerId={activePlayerId}
                  playerHandle={playerTwitterHandle || null}
                  playerHasToken={playerHasTwitterToken}
                  playerFirstName={activePlayerName?.split(" ")[0] || "Player"}
                />
              )}

              {/* Engage Target Schools on X — pulled from active player's pipeline */}
              <TargetSchoolsX programs={pipelinePrograms} />

              {/* Program X account — connect or show connected handle */}
              {managedProgramId && coachProgramName && (
                <TeamTwitterConnect
                  programId={managedProgramId}
                  programName={coachProgramName}
                  twitterHandle={programTwitterHandle}
                />
              )}

              {/* Coach quick stats for active player */}
              <HubActionItems
                pipelineCount={pipelineCount}
                stages={stages}
                emailsSent={emailsSent}
                dmsSent={dmsSent}
                campaignCount={campaignCount}
              />
            </>
          )}
        </div>

        {/* Right column — content + actions */}
        <div className="flex flex-col gap-6 lg:col-span-5">
          {!isCoach && (
            <>
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
            </>
          )}
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
