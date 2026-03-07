"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Users,
  MessageCircle,
  FileText,
  Lock,
  Globe,
  Link2,
  ExternalLink,
  Pin,
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

interface TwitterProfileCardProps {
  profile: TwitterProfile | null
  handle: string | null
  loadFailed?: boolean
  onConnect: () => void
}

export function TwitterProfileCard({ profile, handle, loadFailed, onConnect }: TwitterProfileCardProps) {
  if (!profile && !handle) {
    // Not connected state
    return (
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-primary/5 to-primary/10 p-6 sm:p-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 ring-2 ring-primary/20">
              <MessageCircle className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold uppercase tracking-tight text-foreground">
                Connect Your X Account
              </h3>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                See exactly what coaches see when they click your profile. Get a personalized recruiting readiness score and actionable fixes.
              </p>
            </div>
            <button
              type="button"
              onClick={onConnect}
              className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Link2 className="h-4 w-4" />
              Connect X Account
            </button>
          </div>
        </div>
      </Card>
    )
  }

  // Connected but profile couldn't load (expired/broken token)
  if (!profile && handle) {
    return (
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-primary to-primary/80 px-5 py-3 sm:px-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary-foreground/60">
            My X Profile
          </p>
        </div>
        <div className="p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground ring-2 ring-border">
              <MessageCircle className="h-7 w-7" />
            </div>
            <div>
              <p className="text-base font-bold text-foreground">@{handle}</p>
              {loadFailed ? (
                <div className="mt-1">
                  <p className="text-sm text-muted-foreground">Couldn&apos;t load X profile — token may have expired.</p>
                  <button
                    type="button"
                    onClick={onConnect}
                    className="mt-2 text-xs font-semibold text-primary underline-offset-2 hover:underline"
                  >
                    Reconnect X Account
                  </button>
                </div>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Connected · loading profile details...</p>
              )}
            </div>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      {/* Header band */}
      <div className="bg-gradient-to-r from-primary to-primary/80 px-5 py-3 sm:px-6">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary-foreground/60">
            My X Profile
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
      </div>
    </Card>
  )
}

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M"
  if (n >= 1000) return (n / 1000).toFixed(1) + "K"
  return String(n)
}
