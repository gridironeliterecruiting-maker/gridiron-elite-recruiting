"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import {
  ArrowLeft,
  Globe,
  MapPin,
  Users,
  Mail,
  ExternalLink,
  Newspaper,
  Trophy,
  Calendar,
  BarChart3,
  Loader2,
  Plus,
} from "lucide-react"
import { AddToPipelineDialog } from "@/components/programs/add-to-pipeline-dialog"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"

const divisionColorMap: Record<string, string> = {
  FBS: "bg-primary text-primary-foreground",
  FCS: "bg-primary/70 text-primary-foreground",
  DII: "bg-primary/50 text-primary-foreground",
  DIII: "bg-muted-foreground/70 text-card",
  JUCO: "bg-muted-foreground/50 text-card",
  NAIA: "bg-accent/80 text-accent-foreground",
}

interface Program {
  id: string
  school_name: string
  division: string
  conference: string
  state?: string
  city?: string
  logo_url: string | null
  website?: string | null
  espn_id?: number | null
}

interface Coach {
  id: string
  program_id: string
  first_name: string
  last_name: string
  title: string
  email: string
  phone?: string | null
  twitter_handle: string | null
  twitter_dm_open: boolean
}

interface ESPNData {
  color?: string
  alternateColor?: string
  standingSummary?: string
  links?: { text: string; href: string }[]
  news?: { headline: string; description: string; published: string; link: string; image?: string }[]
  record?: {
    overall?: string
    home?: string
    away?: string
    conference?: string
    streak?: string
    apTop25?: string
    season?: string
  }
}

interface Stage {
  id: string
  name: string
  display_order: number
}

interface ProgramDetailProps {
  program: Program
  coaches: Coach[]
  onBack: () => void
  onSelectCoach: (coach: Coach) => void
  pipelineProgramIds?: string[]
  pipelineStages?: Stage[]
  onPipelineAdded?: () => void
}

function SchoolLogo({ school, logoUrl, size = 40 }: { school: string; logoUrl: string | null; size?: number }) {
  if (logoUrl) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-primary/20 overflow-hidden"
        style={{ width: size, height: size }}
      >
        <Image src={logoUrl} alt={school} width={size - 8} height={size - 8} className="object-contain" />
      </div>
    )
  }
  const initials = school.slice(0, 3).toUpperCase()
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary ring-1 ring-primary/20"
      style={{ width: size, height: size }}
    >
      {initials}
    </div>
  )
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

export function ProgramDetail({ program, coaches, onBack, onSelectCoach, pipelineProgramIds, pipelineStages, onPipelineAdded }: ProgramDetailProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [espn, setEspn] = useState<ESPNData | null>(null)
  const [espnLoading, setEspnLoading] = useState(false)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const showAddButton = pipelineProgramIds && pipelineStages && pipelineStages.length > 0 && !pipelineProgramIds.includes(program.id)

  useEffect(() => {
    containerRef.current?.scrollTo(0, 0)
  }, [program.id])

  // Fetch ESPN data
  useEffect(() => {
    const espnId = program.espn_id || extractEspnId(program.logo_url)
    if (!espnId) return

    setEspnLoading(true)
    setEspn(null)
    fetch(`/api/espn/team?id=${espnId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setEspn(data) })
      .catch(() => {})
      .finally(() => setEspnLoading(false))
  }, [program.id, program.espn_id, program.logo_url])

  const teamColor = espn?.color ? `#${espn.color}` : undefined

  return (
    <div
      ref={containerRef}
      className="animate-in slide-in-from-right-8 fade-in fixed inset-0 z-[60] overflow-y-auto bg-background duration-300"
    >
      {/* Sticky header with optional team color accent */}
      <div className="sticky top-0 z-10 border-b border-border bg-card shadow-sm">
        {teamColor && (
          <div className="h-1" style={{ background: `linear-gradient(90deg, ${teamColor}, ${espn?.alternateColor ? `#${espn.alternateColor}` : teamColor})` }} />
        )}
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 lg:px-8">
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div className="flex min-w-0 flex-1 items-center gap-3">
            <SchoolLogo school={program.school_name} logoUrl={program.logo_url} />
            <div>
              <h1 className="font-display text-lg font-bold uppercase tracking-tight text-foreground sm:text-xl">
                {program.school_name}
              </h1>
              <div className="flex items-center gap-2">
                <Badge
                  className={`${divisionColorMap[program.division] || "bg-secondary text-secondary-foreground"} rounded-md text-[9px] font-bold uppercase tracking-wider`}
                >
                  {program.division}
                </Badge>
                <span className="text-xs text-muted-foreground">{program.conference}</span>
                {espn?.standingSummary && (
                  <>
                    <span className="text-xs text-muted-foreground/40">·</span>
                    <span className="text-xs font-medium text-primary">{espn.standingSummary}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {showAddButton && (
            <button
              type="button"
              onClick={() => setAddDialogOpen(true)}
              className="inline-flex shrink-0 items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground transition-all hover:bg-accent/90"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Program
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
        <div className="flex flex-col gap-6">
          {/* Program Info Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {program.city && (
              <Card className="flex items-center gap-3 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Location</p>
                  <p className="text-sm font-semibold text-foreground">{program.city}, {program.state}</p>
                </div>
              </Card>
            )}
            {espn?.record?.overall && (
              <Card className="flex items-center gap-3 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Trophy className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {espn.record.season === "2024" ? "2024 Record" : "Record"}
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {espn.record.overall}
                    {espn.record.conference && <span className="text-muted-foreground font-normal"> ({espn.record.conference} conf)</span>}
                  </p>
                </div>
              </Card>
            )}
            {program.website && (
              <Card className="flex items-center gap-3 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Globe className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Website</p>
                  <a href={program.website} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-primary hover:underline truncate block max-w-[180px]">
                    {program.website.replace(/^https?:\/\//, "")}
                  </a>
                </div>
              </Card>
            )}
            <Card className="flex items-center gap-3 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Coaches in DB</p>
                <p className="text-sm font-semibold text-foreground">{coaches.length}</p>
              </div>
            </Card>
          </div>

          {/* ESPN Quick Links */}
          {espn?.links && espn.links.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {espn.links.map((link) => (
                <a
                  key={link.text}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
                >
                  {link.text === "Roster" && <Users className="h-3 w-3" />}
                  {link.text === "Schedule" && <Calendar className="h-3 w-3" />}
                  {link.text === "Statistics" && <BarChart3 className="h-3 w-3" />}
                  {link.text === "Clubhouse" && <Globe className="h-3 w-3" />}
                  ESPN {link.text}
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              ))}
            </div>
          )}

          {/* Recent News */}
          {espnLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading program intel...
            </div>
          )}

          {espn?.news && espn.news.length > 0 && (
            <div>
              <h2 className="mb-4 font-display text-base font-bold uppercase tracking-wider text-foreground">
                Recent News
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {espn.news.map((article, i) => (
                  <a
                    key={i}
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group"
                  >
                    <Card className="h-full overflow-hidden transition-all group-hover:border-primary/30 group-hover:shadow-md">
                      {article.image && (
                        <div className="relative h-32 w-full overflow-hidden bg-secondary">
                          <Image
                            src={article.image}
                            alt={article.headline}
                            fill
                            className="object-cover transition-transform group-hover:scale-105"
                          />
                        </div>
                      )}
                      <div className="p-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Newspaper className="h-3 w-3 shrink-0 text-primary" />
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {timeAgo(article.published)}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-foreground line-clamp-2 transition-colors group-hover:text-primary">
                          {article.headline}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                          {article.description}
                        </p>
                      </div>
                    </Card>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Coaching Staff */}
          <div>
            <h2 className="mb-4 font-display text-base font-bold uppercase tracking-wider text-foreground">
              Coaching Staff
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {coaches.map((coach) => (
                <button
                  key={coach.id}
                  type="button"
                  onClick={() => onSelectCoach(coach)}
                  className="group text-left"
                >
                  <Card className="h-full p-4 transition-all group-hover:border-primary/30 group-hover:shadow-md">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground ring-2 ring-primary/20">
                        {coach.first_name[0]}{coach.last_name[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                          {coach.first_name} {coach.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground">{coach.title}</p>
                        {coach.email && (
                          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-primary">
                            <Mail className="h-3 w-3" />
                            <span className="truncate">{coach.email}</span>
                          </div>
                        )}
                      </div>
                      <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-primary" />
                    </div>
                  </Card>
                </button>
              ))}

              {coaches.length === 0 && (
                <Card className="col-span-full flex flex-col items-center justify-center p-8">
                  <Users className="mb-2 h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No coaches in database yet.</p>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>

      {showAddButton && pipelineStages && (
        <AddToPipelineDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          programId={program.id}
          programName={program.school_name}
          stages={pipelineStages}
          onAdded={onPipelineAdded}
        />
      )}
    </div>
  )
}

function extractEspnId(logoUrl: string | null): number | null {
  if (!logoUrl) return null
  const match = logoUrl.match(/ncaa\/500\/(\d+)\.png/)
  return match ? parseInt(match[1]) : null
}
