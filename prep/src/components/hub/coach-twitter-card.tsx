"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Users,
  FileText,
  Lock,
  Globe,
  ExternalLink,
  Pin,
  Heart,
  Repeat2,
  MessageCircle,
  Megaphone,
} from "lucide-react"

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

interface CoachTwitterCardProps {
  playerId: string
  playerHandle: string | null
  playerHasToken: boolean
  playerFirstName: string
}

export function CoachTwitterCard({ playerId, playerHandle, playerHasToken, playerFirstName }: CoachTwitterCardProps) {
  const [profile, setProfile] = useState<TwitterProfile | null>(null)
  const [loading, setLoading] = useState(playerHasToken)

  useEffect(() => {
    if (!playerHasToken) return

    let cancelled = false

    async function fetchPlayerProfile() {
      try {
        const res = await fetch(`/api/twitter/profile?playerId=${playerId}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (!cancelled && data.profile) {
          setProfile(data.profile)
        }
      } catch {
        // Silently fail — card will show handle-only fallback
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchPlayerProfile()
    return () => { cancelled = true }
  }, [playerHasToken, playerId])

  // No twitter at all — don't render
  if (!playerHasToken && !playerHandle) return null

  // Handle-only (player hasn't connected X, but has a handle in their profile)
  if (!playerHasToken && playerHandle) {
    return (
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-primary to-primary/80 px-5 py-3 sm:px-6">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary-foreground/60">
              {playerFirstName}&apos;s X Profile
            </p>
            <a
              href={`https://x.com/${playerHandle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] font-semibold text-primary-foreground/70 transition-colors hover:text-primary-foreground"
            >
              Open in X
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
        <div className="p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground ring-2 ring-border">
              <MessageCircle className="h-7 w-7" />
            </div>
            <div>
              <p className="text-base font-bold text-foreground">@{playerHandle}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {playerFirstName} has an X account but hasn&apos;t connected it yet.
              </p>
            </div>
          </div>
          <EngagementPrompts playerFirstName={playerFirstName} handle={playerHandle} />
        </div>
      </Card>
    )
  }

  // Loading state
  if (loading) {
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

  // Full profile loaded
  if (profile) {
    return (
      <Card className="overflow-hidden">
        {/* Header band */}
        <div className="bg-gradient-to-r from-primary to-primary/80 px-5 py-3 sm:px-6">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary-foreground/60">
              {playerFirstName}&apos;s X Profile
            </p>
            <a
              href={`https://x.com/${profile.username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] font-semibold text-primary-foreground/70 transition-colors hover:text-primary-foreground"
            >
              Open in X
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          {/* Profile row */}
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="shrink-0">
              {profile.profileImageUrl ? (
                <img
                  src={profile.profileImageUrl.replace("_normal", "_200x200")}
                  alt={profile.name}
                  className="h-16 w-16 rounded-full ring-2 ring-border"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none"
                  }}
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground ring-2 ring-border">
                  {profile.name.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>

            {/* Name + handle */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground">{profile.name}</h3>
                {profile.isProtected ? (
                  <Badge className="border-0 bg-amber-100 text-amber-700 text-[10px]">
                    <Lock className="mr-0.5 h-2.5 w-2.5" />
                    Private
                  </Badge>
                ) : (
                  <Badge className="border-0 bg-green-100 text-green-700 text-[10px]">
                    <Globe className="mr-0.5 h-2.5 w-2.5" />
                    Public
                  </Badge>
                )}
              </div>
              <p className="text-sm text-primary">@{profile.username}</p>

              {/* Bio */}
              {profile.description && (
                <p className="mt-2 text-sm leading-relaxed text-foreground/80">
                  {profile.description}
                </p>
              )}

              {/* Stats row */}
              <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  <strong className="text-foreground">{formatNumber(profile.followersCount)}</strong> followers
                </span>
                <span className="flex items-center gap-1">
                  <strong className="text-foreground">{formatNumber(profile.followingCount)}</strong> following
                </span>
                <span className="flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  <strong className="text-foreground">{formatNumber(profile.tweetCount)}</strong> posts
                </span>
              </div>
            </div>
          </div>

          {/* Pinned tweet */}
          {profile.pinnedTweet && (
            <div className="mt-4 rounded-lg border border-border bg-secondary/30 p-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                <Pin className="h-3 w-3" />
                Pinned Post
              </div>
              <p className="text-sm leading-relaxed text-foreground/80">
                {profile.pinnedTweet.text.length > 200
                  ? profile.pinnedTweet.text.slice(0, 200) + "..."
                  : profile.pinnedTweet.text}
              </p>
              {profile.pinnedTweet.hasMedia && (
                <Badge className="mt-2 border-0 bg-primary/10 text-primary text-[10px]">
                  Has media attached
                </Badge>
              )}
            </div>
          )}

          {/* Coach engagement prompts */}
          <EngagementPrompts playerFirstName={playerFirstName} handle={profile.username} />
        </div>
      </Card>
    )
  }

  // Token exists but profile fetch failed — show handle fallback
  if (playerHandle) {
    return (
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-primary to-primary/80 px-5 py-3 sm:px-6">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary-foreground/60">
              {playerFirstName}&apos;s X Profile
            </p>
            <a
              href={`https://x.com/${playerHandle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] font-semibold text-primary-foreground/70 transition-colors hover:text-primary-foreground"
            >
              Open in X
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
        <div className="p-5 sm:p-6">
          <p className="text-sm text-muted-foreground">@{playerHandle}</p>
          <EngagementPrompts playerFirstName={playerFirstName} handle={playerHandle} />
        </div>
      </Card>
    )
  }

  return null
}

function EngagementPrompts({ playerFirstName, handle }: { playerFirstName: string; handle: string }) {
  return (
    <div className="mt-4 rounded-lg border border-accent/20 bg-accent/5 p-4">
      <div className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-accent">
        <Megaphone className="h-3.5 w-3.5" />
        Boost {playerFirstName}&apos;s Visibility
      </div>
      <ul className="space-y-2 text-sm text-foreground/80">
        <li className="flex items-start gap-2">
          <Heart className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
          <span>Like {playerFirstName}&apos;s posts — especially highlight films and game recaps</span>
        </li>
        <li className="flex items-start gap-2">
          <Repeat2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
          <span>Repost highlights and tag college coaches to put {playerFirstName} on their radar</span>
        </li>
        <li className="flex items-start gap-2">
          <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
          <span>Comment with stats and endorsements — coaches read the replies</span>
        </li>
      </ul>
      <a
        href={`https://x.com/${handle}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-xs font-bold text-accent-foreground transition-colors hover:bg-accent/90"
      >
        <ExternalLink className="h-3 w-3" />
        Visit {playerFirstName}&apos;s X Profile
      </a>
    </div>
  )
}

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M"
  if (n >= 1000) return (n / 1000).toFixed(1) + "K"
  return String(n)
}
