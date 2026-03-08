"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Building2,
  UserCheck,
  Send,
  Target,
  TrendingUp,
  TrendingDown,
  CalendarDays,
  ClipboardList,
  CheckCircle2,
  Zap,
  Users,
  GitBranch,
  Mail,
  ArrowRight,
  BarChart3,
} from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { RecruitingTicker } from "@/components/dashboard/recruiting-ticker"
import { GmailTokenCaptureWrapper } from "@/components/gmail-token-capture-wrapper"

interface DashboardClientProps {
  firstName: string
  programCount: number
  coachCount: number
  pipelineCount: number
  stages: { name: string; count: number }[]
}

export function DashboardClient({
  firstName,
  programCount,
  coachCount,
  pipelineCount,
  stages,
}: DashboardClientProps) {
  const now = new Date()
  const hour = now.getHours()
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
  const formattedDate = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const stats = [
    {
      label: "Programs in DB",
      value: programCount,
      icon: Building2,
      trend: programCount > 0 ? `${programCount} tracked` : "Get started",
      trendUp: programCount > 0,
      color: "primary" as const,
    },
    {
      label: "Coaches in DB",
      value: coachCount,
      icon: UserCheck,
      trend: coachCount > 0 ? `${coachCount} contacts` : "Add coaches",
      trendUp: coachCount > 0,
      color: "primary" as const,
    },
    {
      label: "Outreach Sent",
      value: 0,
      icon: Send,
      trend: "Get started",
      trendUp: false,
      color: "accent" as const,
    },
    {
      label: "In Pipeline",
      value: pipelineCount,
      icon: Target,
      trend: pipelineCount > 0 ? `${pipelineCount} programs` : "Build pipeline",
      trendUp: pipelineCount > 0,
      color: "primary" as const,
    },
  ]

  const totalPipeline = stages.reduce((sum, s) => sum + s.count, 0) || 1

  const links = [
    {
      title: "Browse Programs",
      description: "Search and filter college programs and coaches",
      icon: Users,
      color: "primary" as const,
      href: "/coaches",
    },
    {
      title: "Pipeline",
      description: "Track your recruiting pipeline stages",
      icon: GitBranch,
      color: "primary" as const,
      href: "/pipeline",
    },
    {
      title: "Outreach Center",
      description: "Manage email templates and outreach",
      icon: Mail,
      color: "accent" as const,
      href: "/outreach",
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Gmail token capture after OAuth redirect */}
      <Suspense fallback={null}>
        <GmailTokenCaptureWrapper />
      </Suspense>
      {/* Welcome */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-foreground sm:text-3xl">
            {greeting}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            YOUR RECRUITING OVERVIEW AT A GLANCE
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" />
          {formattedDate}
        </div>
      </div>

      {/* Ticker */}
      <RecruitingTicker />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card
            key={stat.label}
            className="group relative overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5"
          >
            <div
              className={`absolute inset-x-0 top-0 h-1 ${
                stat.color === "accent" ? "bg-accent" : "bg-primary"
              }`}
            />
            <CardContent className="p-5 pt-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {stat.label}
                  </p>
                  <p className="mt-2 font-display text-4xl font-bold tracking-tight text-foreground">
                    {stat.value}
                  </p>
                </div>
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${
                    stat.color === "accent"
                      ? "bg-accent/10 text-accent"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                {stat.trendUp ? (
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span
                  className={`text-xs font-medium ${
                    stat.trendUp ? "text-emerald-600" : "text-muted-foreground"
                  }`}
                >
                  {stat.trend}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Action items */}
        <div className="lg:col-span-2">
          <Card className="flex flex-col">
            <CardHeader className="flex-row items-center justify-between pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <ClipboardList className="h-4 w-4 text-primary" />
                </div>
                <CardTitle className="text-base font-bold">Action Items</CardTitle>
              </div>
              <Badge variant="secondary" className="text-xs font-medium">
                0 pending
              </Badge>
            </CardHeader>
            <CardContent className="flex-1 pt-0">
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
                  <CheckCircle2 className="h-7 w-7 text-muted-foreground/50" />
                </div>
                <p className="mt-4 text-sm font-semibold text-foreground">
                  {"You're all caught up!"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Action items from your outreach and pipeline will appear here.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick links */}
        <Card className="flex flex-col">
          <CardHeader className="flex-row items-center gap-2.5 pb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-base font-bold">Quick Links</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 pt-0">
            <div className="flex flex-col gap-2">
              {links.map((link) => (
                <Link
                  key={link.title}
                  href={link.href}
                  className="group flex items-center gap-4 rounded-lg border border-transparent px-4 py-3.5 text-left transition-all hover:border-border hover:bg-secondary hover:shadow-sm"
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                      link.color === "accent"
                        ? "bg-accent/10 text-accent"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    <link.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{link.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{link.description}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/0 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline preview */}
      {stages.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center gap-2.5 pb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <BarChart3 className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-base font-bold">Pipeline Overview</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-col gap-4">
              {stages.map((stage) => (
                <div key={stage.name} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground">{stage.name}</span>
                    <span className="font-display text-sm font-bold text-foreground">
                      {stage.count}
                    </span>
                  </div>
                  <Progress
                    value={totalPipeline > 0 ? (stage.count / totalPipeline) * 100 : 0}
                    className="h-2 bg-secondary"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
