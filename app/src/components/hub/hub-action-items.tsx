"use client"

import { Card } from "@/components/ui/card"

interface HubActionItemsProps {
  pipelineCount: number
  stages: { name: string; count: number }[]
  emailsSent: number
  dmsSent: number
  campaignCount: number
}

export function HubActionItems({
  emailsSent,
  dmsSent,
  campaignCount,
}: HubActionItemsProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Outreach stats */}
      <Card>
        <div className="p-5 sm:p-6">
          <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wider text-foreground">
            Outreach Stats
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-secondary/50 p-3 text-center">
              <p className="font-display text-2xl font-bold text-foreground">{campaignCount}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Campaigns</p>
            </div>
            <div className="rounded-lg bg-secondary/50 p-3 text-center">
              <p className="font-display text-2xl font-bold text-foreground">{emailsSent}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Emails Sent</p>
            </div>
            <div className="rounded-lg bg-secondary/50 p-3 text-center">
              <p className="font-display text-2xl font-bold text-foreground">{dmsSent}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">DMs Sent</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
