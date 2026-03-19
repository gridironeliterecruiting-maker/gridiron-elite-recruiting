"use client"

import { Card } from "@/components/ui/card"
import { Camera, Lock } from "lucide-react"

export function InstagramPlaceholder() {
  return (
    <Card className="overflow-hidden">
      <div className="p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">
            Instagram Snapshot
          </h3>
          <span className="flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
            <Lock className="h-2.5 w-2.5" />
            Coming Soon
          </span>
        </div>
        <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border py-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-purple-100 to-pink-100">
            <Camera className="h-7 w-7 text-purple-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Instagram Integration
            </p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              Connect your Instagram to audit your visual brand. Coaches check
              your IG too — make sure your grid tells the right story.
            </p>
          </div>
        </div>
      </div>
    </Card>
  )
}
