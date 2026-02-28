"use client"

import { Card } from "@/components/ui/card"
import { ExternalLink, Link2 } from "lucide-react"

interface TeamTwitterConnectProps {
  programId: string
  programName: string
  twitterHandle: string | null
}

export function TeamTwitterConnect({ programId, programName, twitterHandle }: TeamTwitterConnectProps) {
  const handleConnect = () => {
    const returnTo = window.location.pathname
    window.location.href = `/api/twitter/authorize?programId=${encodeURIComponent(programId)}&returnTo=${encodeURIComponent(returnTo)}`
  }

  if (twitterHandle) {
    return (
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-primary to-primary/80 px-5 py-3 sm:px-6">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary-foreground/60">
              Program X Account
            </p>
            <a
              href={`https://x.com/${twitterHandle}`}
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
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black font-black text-white" style={{ fontSize: 14 }}>
              X
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">@{twitterHandle}</p>
              <p className="text-xs text-muted-foreground">{programName} program account connected</p>
            </div>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-br from-primary/5 to-primary/10 p-6 sm:p-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 ring-2 ring-primary/20">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black font-black text-white" style={{ fontSize: 16 }}>
              X
            </div>
          </div>
          <div>
            <h3 className="font-display text-lg font-bold uppercase tracking-tight text-foreground">
              Connect the {programName} X Account
            </h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Connect the football program&apos;s X account in order to engage with players, share posts, and boost your team&apos;s recruiting profile on X.
            </p>
          </div>
          <button
            type="button"
            onClick={handleConnect}
            className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Link2 className="h-4 w-4" />
            Connect Team X Account
          </button>
        </div>
      </div>
    </Card>
  )
}
