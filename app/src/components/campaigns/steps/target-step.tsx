"use client"

import { useEffect, useState, useMemo } from "react"
import Image from "next/image"
import {
  Search,
  Users,
  Check,
  ChevronDown,
  ChevronRight,
  X,
  Mail,
  Loader2,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

// ─── Position alias map for fuzzy matching ─────────────────────
const POSITION_ALIASES: Record<string, string[]> = {
  QB: ["quarterback"],
  WR: ["wide receiver", "receivers"],
  RB: ["running back"],
  TE: ["tight end"],
  OL: ["offensive line", "o-line"],
  OT: ["offensive line", "offensive tackle", "o-line"],
  OG: ["offensive line", "offensive guard", "o-line"],
  C: ["offensive line", "center", "o-line"],
  DL: ["defensive line", "d-line"],
  DE: ["defensive line", "defensive end", "d-line"],
  DT: ["defensive line", "defensive tackle", "d-line"],
  LB: ["linebacker"],
  CB: ["defensive back", "cornerback", "secondary"],
  S: ["defensive back", "safety", "secondary"],
  DB: ["defensive back", "secondary"],
  K: ["special teams", "kicker", "kicking"],
  P: ["special teams", "punter", "kicking"],
  LS: ["special teams", "long snapper"],
  ATH: [],
}

function matchesPosition(coachTitle: string, playerPosition: string): boolean {
  const title = coachTitle.toLowerCase()
  const pos = playerPosition.toUpperCase().trim()
  const aliases = POSITION_ALIASES[pos] || []
  return aliases.some((alias) => title.includes(alias))
}

function isRecruitingCoach(title: string): boolean {
  return title.toLowerCase().includes("recruit")
}

function shouldAutoSelect(coachTitle: string, playerPosition: string): boolean {
  return isRecruitingCoach(coachTitle) || matchesPosition(coachTitle, playerPosition)
}

// ─── Types ──────────────────────────────────────────────────────
interface Program {
  id: string
  school_name: string
  division: string
  conference: string
  logo_url: string | null
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
}

interface SelectedCoach {
  coachId: string
  programId: string
  programName: string
  coachName: string
  title: string
  email: string
}

const DIVISIONS = ["FBS", "FCS", "DII", "DIII", "JUCO", "NAIA"]

const divisionColorMap: Record<string, string> = {
  FBS: "bg-primary text-primary-foreground",
  FCS: "bg-primary/70 text-primary-foreground",
  DII: "bg-primary/50 text-primary-foreground",
  DIII: "bg-muted-foreground/70 text-card",
  JUCO: "bg-muted-foreground/50 text-card",
  NAIA: "bg-accent/80 text-accent-foreground",
}

interface NavState {
  activeDivision: string | null
  expandedConference: string | null
}

interface TargetStepProps {
  programs: Program[]
  playerPosition: string
  selectedCoaches: SelectedCoach[]
  onCoachesChange: (coaches: SelectedCoach[]) => void
  onNext: () => void
  onBack: () => void
  initialNavState?: NavState
  onNavStateChange?: (state: NavState) => void
}

export function TargetStep({
  programs,
  playerPosition,
  selectedCoaches,
  onCoachesChange,
  onNext,
  onBack,
  initialNavState,
  onNavStateChange,
}: TargetStepProps) {
  const [activeDivision, setActiveDivisionRaw] = useState<string | null>(initialNavState?.activeDivision ?? null)
  const [expandedConference, setExpandedConferenceRaw] = useState<string | null>(initialNavState?.expandedConference ?? null)
  const [coachOverlayProgram, setCoachOverlayProgram] = useState<Program | null>(null)
  const [programCoaches, setProgramCoaches] = useState<Record<string, Coach[]>>({})
  const [loadingCoaches, setLoadingCoaches] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectAllLoading, setSelectAllLoading] = useState(false)

  // Wrappers that also persist nav state to parent
  const setActiveDivision = (val: string | null) => {
    setActiveDivisionRaw(val)
    onNavStateChange?.({ activeDivision: val, expandedConference: null })
  }
  const setExpandedConference = (val: string | null) => {
    setExpandedConferenceRaw(val)
    onNavStateChange?.({ activeDivision, expandedConference: val })
  }

  // Group programs by division → conference
  const divisionMap = useMemo(() => {
    const map: Record<string, Record<string, Program[]>> = {}
    for (const p of programs) {
      if (!map[p.division]) map[p.division] = {}
      if (!map[p.division][p.conference]) map[p.division][p.conference] = []
      map[p.division][p.conference].push(p)
    }
    // Sort programs within each conference
    for (const div of Object.values(map)) {
      for (const conf of Object.keys(div)) {
        div[conf].sort((a, b) => a.school_name.localeCompare(b.school_name))
      }
    }
    return map
  }, [programs])

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    return programs
      .filter((p) => p.school_name.toLowerCase().includes(q))
      .slice(0, 10)
  }, [searchQuery, programs])

  // Get conferences for active division
  const conferences = useMemo(() => {
    if (!activeDivision || !divisionMap[activeDivision]) return []
    return Object.keys(divisionMap[activeDivision]).sort()
  }, [activeDivision, divisionMap])

  // Get programs for expanded conference
  const conferencePrograms = useMemo(() => {
    if (!activeDivision || !expandedConference) return []
    return divisionMap[activeDivision]?.[expandedConference] || []
  }, [activeDivision, expandedConference, divisionMap])

  // Count selected coaches per conference
  const coachCountByConference = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const sc of selectedCoaches) {
      const prog = programs.find((p) => p.id === sc.programId)
      if (prog) {
        const key = `${prog.division}:${prog.conference}`
        counts[key] = (counts[key] || 0) + 1
      }
    }
    return counts
  }, [selectedCoaches, programs])

  // Check if a program has any selected coaches
  const programHasSelections = (programId: string) =>
    selectedCoaches.some((sc) => sc.programId === programId)

  // Fetch coaches for a program
  const fetchCoaches = async (programId: string) => {
    if (programCoaches[programId]) return programCoaches[programId]
    setLoadingCoaches(programId)
    try {
      const res = await fetch(`/api/programs/${programId}/coaches`)
      const data = await res.json()
      setProgramCoaches((prev) => ({ ...prev, [programId]: data }))
      return data as Coach[]
    } catch {
      return []
    } finally {
      setLoadingCoaches(null)
    }
  }

  // Auto-select coaches for a single program (recruiting coordinators + position coaches only)
  const autoSelectProgram = async (program: Program) => {
    const coaches = await fetchCoaches(program.id)
    const autoSelected = coaches.filter((c) => shouldAutoSelect(c.title, playerPosition))

    // If no coaches match auto-select criteria, open the overlay for manual selection
    if (autoSelected.length === 0) {
      openCoachOverlay(program)
      return
    }

    const newSelections = autoSelected.map((c) => ({
      coachId: c.id,
      programId: program.id,
      programName: program.school_name,
      coachName: `${c.first_name} ${c.last_name}`,
      title: c.title,
      email: c.email,
    }))

    // Use functional update to avoid stale closure
    onCoachesChange([...selectedCoaches.filter((sc) => sc.programId !== program.id), ...newSelections])
  }

  // Batch auto-select for multiple programs (used by Select All)
  const autoSelectPrograms = async (progs: Program[]) => {
    const allNewSelections: SelectedCoach[] = []
    const alreadySelectedProgramIds = new Set(selectedCoaches.map((sc) => sc.programId))

    for (const p of progs) {
      if (alreadySelectedProgramIds.has(p.id)) continue
      const coaches = await fetchCoaches(p.id)
      const autoSelected = coaches.filter((c) => shouldAutoSelect(c.title, playerPosition))

      for (const c of autoSelected) {
        allNewSelections.push({
          coachId: c.id,
          programId: p.id,
          programName: p.school_name,
          coachName: `${c.first_name} ${c.last_name}`,
          title: c.title,
          email: c.email,
        })
      }
    }

    if (allNewSelections.length > 0) {
      onCoachesChange([...selectedCoaches, ...allNewSelections])
    }
  }

  // Deselect all coaches for a program
  const deselectProgram = (programId: string) => {
    onCoachesChange(selectedCoaches.filter((sc) => sc.programId !== programId))
  }

  // Toggle a single coach
  const toggleCoach = (coach: Coach, program: Program) => {
    const existing = selectedCoaches.find((sc) => sc.coachId === coach.id)
    if (existing) {
      onCoachesChange(selectedCoaches.filter((sc) => sc.coachId !== coach.id))
    } else {
      onCoachesChange([
        ...selectedCoaches,
        {
          coachId: coach.id,
          programId: program.id,
          programName: program.school_name,
          coachName: `${coach.first_name} ${coach.last_name}`,
          title: coach.title,
          email: coach.email,
        },
      ])
    }
  }

  // Select all programs in a conference
  const [confSelectLoading, setConfSelectLoading] = useState(false)
  const selectAllConference = async (conference: string) => {
    if (!activeDivision) return
    setConfSelectLoading(true)
    try {
      const progs = divisionMap[activeDivision]?.[conference] || []
      await autoSelectPrograms(progs)
    } finally {
      setConfSelectLoading(false)
    }
  }

  // Open coach overlay for a program
  const openCoachOverlay = async (program: Program) => {
    await fetchCoaches(program.id)
    setCoachOverlayProgram(program)
  }

  return (
    <div className="relative">
      {/* Header with coach counter */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="mb-2 font-display text-base font-bold uppercase tracking-wider text-foreground">
            Select Recipients
          </h2>
          <p className="text-sm text-muted-foreground">
            Choose programs and coaches to include in this campaign.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2">
          <Users className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-primary">{selectedCoaches.length}</span>
          <span className="text-xs text-muted-foreground">Coaches Selected</span>
        </div>
      </div>

      {/* Division pills + Search */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {DIVISIONS.map((div) => (
          <button
            key={div}
            type="button"
            onClick={() => {
              setActiveDivision(activeDivision === div ? null : div)
              setExpandedConference(null)
              setCoachOverlayProgram(null)
            }}
            className={`rounded-md px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
              activeDivision === div
                ? `${divisionColorMap[div]} shadow-sm`
                : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
            }`}
          >
            {div}
          </button>
        ))}

        <div className="relative ml-auto flex-1 sm:max-w-[260px]">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search programs..."
            className="w-full rounded-md border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary/30 focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
          {/* Search results dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
              {searchResults.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={async () => {
                    await autoSelectProgram(p)
                    setSearchQuery("")
                    openCoachOverlay(p)
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-secondary/50"
                >
                  {p.logo_url ? (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-white overflow-hidden">
                      <Image src={p.logo_url} alt={p.school_name} width={24} height={24} className="object-contain" />
                    </div>
                  ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary/10 text-[10px] font-bold text-primary">
                      {p.school_name.slice(0, 3).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{p.school_name}</p>
                    <p className="text-[10px] text-muted-foreground">{p.conference} · {p.division}</p>
                  </div>
                  {programHasSelections(p.id) && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Conferences */}
      {activeDivision && conferences.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={selectAllLoading}
            onClick={async () => {
              if (!activeDivision) return
              setSelectAllLoading(true)
              try {
                const allProgs = conferences.flatMap((conf) => divisionMap[activeDivision]?.[conf] || [])
                await autoSelectPrograms(allProgs)
              } finally {
                setSelectAllLoading(false)
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-60"
          >
            {selectAllLoading && <Loader2 className="h-3 w-3 animate-spin" />}
            {selectAllLoading ? "Selecting..." : "Select All"}
          </button>
          {conferences.map((conf) => {
            const countKey = `${activeDivision}:${conf}`
            const count = coachCountByConference[countKey] || 0
            const isExpanded = expandedConference === conf
            return (
              <button
                key={conf}
                type="button"
                onClick={() => {
                  setExpandedConference(isExpanded ? null : conf)
                  setCoachOverlayProgram(null)
                }}
                className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition-all ${
                  isExpanded
                    ? "border-primary/30 bg-primary/5 text-primary"
                    : "border-border bg-card text-muted-foreground hover:border-primary/20 hover:text-foreground"
                }`}
              >
                {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                {/* Show short name if available */}
                {conf.match(/\(([^)]+)\)/)?.[1] || conf}
                {count > 0 && (
                  <Badge variant="outline" className="ml-1 h-4 min-w-[16px] rounded-full bg-primary px-1 text-[9px] text-primary-foreground">
                    {count}
                  </Badge>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Programs in expanded conference */}
      {expandedConference && conferencePrograms.length > 0 && (
        <div className="mb-6">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {expandedConference}
            </span>
            <button
              type="button"
              disabled={confSelectLoading}
              onClick={() => selectAllConference(expandedConference)}
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline disabled:opacity-60"
            >
              {confSelectLoading && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
              {confSelectLoading ? "Selecting..." : "Select All"}
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {conferencePrograms.map((p) => {
              const hasSelections = programHasSelections(p.id)
              const coachCount = selectedCoaches.filter((sc) => sc.programId === p.id).length
              return (
                <div
                  key={p.id}
                  className={`group flex items-center gap-3 rounded-lg border p-3 transition-all ${
                    hasSelections
                      ? "border-primary/30 bg-primary/[0.03]"
                      : "border-border bg-card hover:border-primary/20"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => hasSelections ? deselectProgram(p.id) : autoSelectProgram(p)}
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                      hasSelections
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:border-primary/50"
                    }`}
                  >
                    {hasSelections && <Check className="h-3.5 w-3.5" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => openCoachOverlay(p)}
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  >
                    {p.logo_url ? (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-white overflow-hidden ring-1 ring-primary/10">
                        <Image src={p.logo_url} alt={p.school_name} width={24} height={24} className="object-contain" />
                      </div>
                    ) : (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary/10 text-[10px] font-bold text-primary ring-1 ring-primary/10">
                        {p.school_name.slice(0, 3).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                        {p.school_name}
                      </p>
                    </div>
                    {coachCount > 0 && (
                      <Badge variant="outline" className="h-5 min-w-[20px] rounded-full bg-primary/10 px-1.5 text-[10px] font-bold text-primary">
                        {coachCount}
                      </Badge>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* No division selected prompt */}
      {!activeDivision && searchResults.length === 0 && (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <Users className="mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm font-semibold text-foreground">Select a division to get started</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Or use the search box to find a specific program.
          </p>
        </Card>
      )}

      {/* Navigation */}
      <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md bg-secondary px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-secondary/80"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={selectedCoaches.length === 0}
          className="rounded-md bg-primary px-6 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next — Build Emails
        </button>
      </div>

      {/* Coach Overlay with backdrop blur */}
      {coachOverlayProgram && (
        <>
        <CoachSelectionOverlay
          program={coachOverlayProgram}
          coaches={programCoaches[coachOverlayProgram.id] || []}
          loading={loadingCoaches === coachOverlayProgram.id}
          selectedCoaches={selectedCoaches}
          playerPosition={playerPosition}
          onToggleCoach={(coach) => toggleCoach(coach, coachOverlayProgram)}
          onClose={() => setCoachOverlayProgram(null)}
        />
        </>
      )}
    </div>
  )
}

// ─── Coach Selection Overlay ────────────────────────────────────
function CoachSelectionOverlay({
  program,
  coaches,
  loading,
  selectedCoaches,
  playerPosition,
  onToggleCoach,
  onClose,
}: {
  program: Program
  coaches: Coach[]
  loading: boolean
  selectedCoaches: SelectedCoach[]
  playerPosition: string
  onToggleCoach: (coach: Coach) => void
  onClose: () => void
}) {
  // Sort only once when overlay opens (snapshot of selections at open time)
  const [initialSort] = useState(() => {
    const selectedIds = new Set(selectedCoaches.map((sc) => sc.coachId))
    return [...coaches].sort((a, b) => {
      const aSelected = selectedIds.has(a.id) ? 0 : 1
      const bSelected = selectedIds.has(b.id) ? 0 : 1
      if (aSelected !== bSelected) return aSelected - bSelected
      const aRec = shouldAutoSelect(a.title, playerPosition) ? 0 : 1
      const bRec = shouldAutoSelect(b.title, playerPosition) ? 0 : 1
      return aRec - bRec
    })
  })
  const sortedCoaches = initialSort

  return (
    <div className="animate-in slide-in-from-right-8 fade-in fixed inset-0 z-[70] overflow-y-auto duration-200">
      {/* Dimmed backdrop */}
      <div
        className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
        onClick={onClose}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        role="button"
        tabIndex={0}
        aria-label="Close coach selection"
      />

      {/* Slide-in panel */}
      <div className="absolute inset-y-0 right-0 flex w-full max-w-lg flex-col bg-card shadow-2xl sm:rounded-l-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3">
            {program.logo_url ? (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white overflow-hidden ring-1 ring-primary/20">
                <Image src={program.logo_url} alt={program.school_name} width={32} height={32} className="object-contain" />
              </div>
            ) : (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary ring-1 ring-primary/20">
                {program.school_name.slice(0, 3).toUpperCase()}
              </div>
            )}
            <h2 className="font-display text-lg font-bold uppercase tracking-tight text-foreground truncate">
              {program.school_name}
            </h2>
          </div>
        </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="mb-4 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            We recommend that initial emails to a program target <span className="font-semibold text-foreground">recruiting coaches</span> and your <span className="font-semibold text-foreground">position coach</span>.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : coaches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Users className="mb-2 h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No coaches in database for this program.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {sortedCoaches.map((coach) => {
              const isSelected = selectedCoaches.some((sc) => sc.coachId === coach.id)
              const isRecommended = shouldAutoSelect(coach.title, playerPosition)
              return (
                <button
                  key={coach.id}
                  type="button"
                  onClick={() => onToggleCoach(coach)}
                  className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                    isSelected
                      ? "border-primary/30 bg-primary/[0.03]"
                      : "border-border bg-card hover:border-primary/20"
                  }`}
                >
                  <div
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card"
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                  </div>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground ring-2 ring-primary/20">
                    {coach.first_name[0]}{coach.last_name[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        {coach.first_name} {coach.last_name}
                      </p>
                      {isRecommended && (
                        <Badge variant="outline" className="border-0 bg-primary/10 text-[9px] font-semibold text-primary">
                          Recommended
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{coach.title}</p>
                    {coach.email && (
                      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-primary">
                        <Mail className="h-3 w-3" />
                        <span className="truncate">{coach.email}</span>
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
