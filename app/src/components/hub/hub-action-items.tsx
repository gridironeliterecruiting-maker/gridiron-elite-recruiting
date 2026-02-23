"use client"

import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Mail,
  MessageCircle,
  GitBranch,
  Users,
  ArrowRight,
  Send,
  Target,
  CheckCircle2,
} from "lucide-react"

interface PipelineStage {
  name: string
  count: number
}

interface HubActionItemsProps {
  pipelineCount: number
  stages: PipelineStage[]
  emailsSent: number
  dmsSent: number
  campaignCount: number
}

export function HubActionItems({
  pipelineCount,
  stages,
  emailsSent,
  dmsSent,
  campaignCount,
}: HubActionItemsProps) {
  const actions = [
    {
      title: "Send Email Campaign",
      description: "Reach coaches with personalized emails",
      icon: Mail,
      href: "/outreach",
      color: "accent" as const,
      stat: emailsSent > 0 ? `${emailsSent} sent` : "Get started",
    },
    {
      title: "Send DM Campaign",
      description: "DM coaches directly on X",
      icon: MessageCircle,
      href: "/outreach",
      color: "primary" as const,
      stat: dmsSent > 0 ? `${dmsSent} sent` : "Get started",
    },
    {
      title: "Browse Programs",
      description: "Find and research college programs",
      icon: Users,
      href: "/coaches",
      color: "primary" as const,
      stat: null,
    },
    {
      title: "View Pipeline",
      description: "Track your recruiting stages",
      icon: GitBranch,
      href: "/pipeline",
      color: "primary" as const,
      stat: pipelineCount > 0 ? `${pipelineCount} programs` : "Build pipeline",
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* Quick actions */}
      <Card>
        <div className="p-5 sm:p-6">
          <h3 className="mb-4 font-display text-sm font-bold uppercase tracking-wider text-foreground">
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {actions.map((action) => (
              <Link
                key={action.title}
                href={action.href}
                className="group flex items-center gap-3 rounded-lg border border-transparent px-3 py-3 transition-all hover:border-border hover:bg-secondary/50 hover:shadow-sm"
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    action.color === "accent"
                      ? "bg-accent/10 text-accent"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  <action.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{action.title}</p>
                  <p className="text-[11px] text-muted-foreground">{action.description}</p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/0 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
              </Link>
            ))}
          </div>
        </div>
      </Card>

      {/* Pipeline snapshot */}
      {stages.length > 0 && pipelineCount > 0 && (
        <Card>
          <div className="p-5 sm:p-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">
                Pipeline Snapshot
              </h3>
              <Link
                href="/pipeline"
                className="text-[11px] font-semibold text-primary hover:underline"
              >
                View All
              </Link>
            </div>
            <div className="flex flex-wrap gap-2">
              {stages.map((stage) => (
                <div
                  key={stage.name}
                  className="flex items-center gap-1.5 rounded-md bg-secondary/60 px-2.5 py-1.5"
                >
                  <span className="text-[11px] font-medium text-muted-foreground">{stage.name}</span>
                  <span className="font-display text-sm font-bold text-foreground">{stage.count}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

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
