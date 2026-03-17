"use client"

import { useState, useEffect, Suspense } from "react"
import { X, Mail } from "lucide-react"
import { GmailTokenCaptureWrapper } from "@/components/gmail-token-capture-wrapper"
import { HubHeader } from "@/components/hub/hub-header"
import { TwitterProfileCard } from "@/components/hub/twitter-profile-card"
import { ReadinessScore } from "@/components/hub/readiness-score"
import { ContentCalendar } from "@/components/hub/content-calendar"
import { InstagramPlaceholder } from "@/components/hub/instagram-placeholder"
import { XPartnerProfiles } from "@/components/hub/x-partner-profiles"
import { TargetSchoolsSection } from "@/components/hub/target-schools-section"
import { WelcomeOverlay } from "@/components/welcome-overlay"

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
  pinnedTweet: { text: string; hasMedia: boolean; createdAt: string } | null
  lastTweetAt: string | null
}

export function HubClient({
  profile,
  hasTwitterToken,
  twitterHandle,
  readinessScoreOpen,
  recruitingEmail,
}: {
  profile: AthleteProfile
  hasTwitterToken: boolean
  twitterHandle: string | null
  readinessScoreOpen: boolean
  recruitingEmail: string | null
}) {
  const [twitterProfile, setTwitterProfile] = useState<TwitterProfile | null>(null)
  const [twitterLoading, setTwitterLoading] = useState(hasTwitterToken)
  const [twitterLoadFailed, setTwitterLoadFailed] = useState(false)
  const [effectiveHandle, setEffectiveHandle] = useState<string | null>(twitterHandle)
  const [emailBannerDismissed, setEmailBannerDismissed] = useState(false)

  useEffect(() => {
    setEmailBannerDismissed(localStorage.getItem('hub_email_dismissed') === 'true')
  }, [])

  const dismissEmailBanner = () => {
    localStorage.setItem('hub_email_dismissed', 'true')
    setEmailBannerDismissed(true)
  }

  useEffect(() => {
    if (!hasTwitterToken) return
    let cancelled = false
    async function fetchWithRetry() {
      let lastData: any = null
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await fetch("/api/twitter/profile")
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const data = await res.json()
          lastData = data
          if (cancelled) return
          if (data.connected === false) { setEffectiveHandle(null); setTwitterLoading(false); return }
          if (data.profile) { setTwitterProfile(data.profile); setTwitterLoading(false); return }
        } catch {
          if (attempt === 0) await new Promise(r => setTimeout(r, 2000))
        }
      }
      if (!cancelled) { setTwitterLoading(false); if (!lastData?.profile) setTwitterLoadFailed(true) }
    }
    fetchWithRetry()
    return () => { cancelled = true }
  }, [hasTwitterToken])

  const handleConnectTwitter = () => {
    window.location.href = `/api/twitter/authorize?returnTo=/hub`
  }

  return (
    <div className="flex flex-col gap-6">
      <WelcomeOverlay />
      <Suspense fallback={null}><GmailTokenCaptureWrapper /></Suspense>

      <HubHeader firstName={profile.first_name || "Athlete"} isCoach={false} activePlayerName={null} />

      {recruitingEmail && !emailBannerDismissed && (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="flex items-center justify-between bg-gradient-to-r from-accent/20 to-accent/10 px-5 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Your Outreach Email</p>
            <button onClick={dismissEmailBanner} className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-col items-center gap-4 p-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 ring-2 ring-accent/20">
              <Mail className="h-8 w-8 text-accent" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Your Outreach Email Is:</p>
              <p className="mt-1 font-display text-xl font-bold text-foreground">{recruitingEmail}</p>
              <p className="mt-3 max-w-sm text-sm text-muted-foreground">
                Use this email to contact camps, media outlets, and coaches through Runway Prep.
              </p>
            </div>
            <button onClick={dismissEmailBanner} className="rounded-lg border border-border px-6 py-2 text-xs font-bold uppercase tracking-wider text-foreground transition hover:bg-secondary">
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-7">
          {twitterLoading ? (
            <div className="animate-pulse rounded-xl border bg-card p-6">
              <div className="mb-4 h-3 w-48 rounded bg-secondary" />
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 rounded-full bg-secondary" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 rounded bg-secondary" />
                  <div className="h-3 w-24 rounded bg-secondary" />
                  <div className="h-3 w-full rounded bg-secondary" />
                </div>
              </div>
            </div>
          ) : (
            <TwitterProfileCard profile={twitterProfile} handle={effectiveHandle} loadFailed={twitterLoadFailed} onConnect={handleConnectTwitter} />
          )}

          {!twitterLoading && twitterProfile && (
            <ReadinessScore twitterProfile={twitterProfile} athleteProfile={profile} defaultOpen={readinessScoreOpen} />
          )}

          <XPartnerProfiles />
          <TargetSchoolsSection />
          <InstagramPlaceholder />
        </div>

        <div className="flex flex-col gap-6 lg:col-span-5">
          <ContentCalendar profile={profile} />
        </div>
      </div>
    </div>
  )
}
