"use client"

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Search, ArrowUpDown, Users, Building2, Loader2, ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { ProgramDetail } from "@/components/programs/program-detail"
import { CoachDetail } from "@/components/programs/coach-detail"
import { AddToPipelineDialog } from "@/components/programs/add-to-pipeline-dialog"

const divisions = ["ALL", "FBS", "FCS", "DII", "DIII", "JUCO", "NAIA"] as const
type Division = (typeof divisions)[number]

interface Program {
  id: string
  school_name: string
  division: string
  conference: string
  state: string
  city: string
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

interface Stage {
  id: string
  name: string
  display_order: number
}

type SortField = "school_name" | "division" | "conference" | "state"
type CoachSortField = "last_name" | "school_name" | "has_email" | "dm_open"

const DIVISION_ORDER: Record<string, number> = {
  FBS: 0, FCS: 1, DII: 2, DIII: 3, JUCO: 4, NAIA: 5,
}

const divisionColorMap: Record<string, string> = {
  FBS: "bg-primary text-primary-foreground",
  FCS: "bg-primary/70 text-primary-foreground",
  DII: "bg-primary/50 text-primary-foreground",
  DIII: "bg-muted-foreground/70 text-card",
  JUCO: "bg-muted-foreground/50 text-card",
  NAIA: "bg-accent/80 text-accent-foreground",
}

function SchoolLogo({ school, logoUrl }: { school: string; logoUrl: string | null }) {
  if (logoUrl) {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white ring-1 ring-primary/20 overflow-hidden">
        <Image src={logoUrl} alt={school} width={32} height={32} className="object-contain" />
      </div>
    )
  }
  const initials = school.slice(0, 2).toUpperCase()
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold text-primary ring-1 ring-primary/20">
      {initials}
    </div>
  )
}

export function CoachesClient({ programs }: { programs: Program[] }) {
  const [activeDivision, setActiveDivision] = useState<Division>("ALL")
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<"programs" | "coaches">("programs")
  const [sortField, setSortField] = useState<SortField>("school_name")
  const [sortAsc, setSortAsc] = useState(true)
  const [coachSortField, setCoachSortField] = useState<CoachSortField>("last_name")
  const [coachSortAsc, setCoachSortAsc] = useState(true)

  // Drill-down state
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null)
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null)
  const [coachProgram, setCoachProgram] = useState<Program | null>(null)
  const [programCoaches, setProgramCoaches] = useState<Coach[]>([])
  const [loadingCoaches, setLoadingCoaches] = useState(false)

  // Coach search state (for coaches tab)
  const [coachResults, setCoachResults] = useState<any[]>([])
  const [coachTotal, setCoachTotal] = useState(0)
  const [coachPage, setCoachPage] = useState(0)
  const [coachLoading, setCoachLoading] = useState(false)

  // Pipeline stages & entries for Add to Pipeline
  const [pipelineStages, setPipelineStages] = useState<Stage[]>([])
  const [pipelineProgramIds, setPipelineProgramIds] = useState<string[]>([])
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [addDialogProgram, setAddDialogProgram] = useState<Program | null>(null)

  const COACH_PAGE_SIZE = 50
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  if (!supabaseRef.current) supabaseRef.current = createClient()
  const supabase = supabaseRef.current

  // Fetch pipeline stages and existing pipeline program IDs
  useEffect(() => {
    const fetchPipelineData = async () => {
      const [stagesRes, entriesRes] = await Promise.all([
        supabase.from("pipeline_stages").select("id, name, display_order").order("display_order"),
        supabase.from("pipeline_entries").select("program_id"),
      ])
      if (stagesRes.data) setPipelineStages(stagesRes.data)
      if (entriesRes.data) setPipelineProgramIds(entriesRes.data.map((e: any) => e.program_id))
    }
    fetchPipelineData()
  }, [supabase])

  const refreshPipelineEntries = useCallback(async () => {
    const { data } = await supabase.from("pipeline_entries").select("program_id")
    if (data) setPipelineProgramIds(data.map((e: any) => e.program_id))
  }, [supabase])

  const programMap = useMemo(() => {
    const map: Record<string, Program> = {}
    for (const p of programs) map[p.id] = p
    return map
  }, [programs])

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(!sortAsc)
    else { setSortField(field); setSortAsc(true) }
  }

  const handleCoachSort = (field: CoachSortField) => {
    if (coachSortField === field) setCoachSortAsc(!coachSortAsc)
    else { setCoachSortField(field); setCoachSortAsc(true) }
  }

  // Fetch coaches for a specific program (direct Supabase query)
  const fetchProgramCoaches = useCallback(async (programId: string) => {
    setLoadingCoaches(true)
    const { data } = await supabase
      .from("coaches")
      .select("id, program_id, first_name, last_name, title, email, phone, twitter_handle, twitter_dm_open")
      .eq("program_id", programId)
      .order("last_name")
    setProgramCoaches(data || [])
    setLoadingCoaches(false)
  }, [supabase])

  // Fetch coaches for coaches tab (direct Supabase query)
  const fetchCoaches = useCallback(async (page: number, query: string, division: string) => {
    setCoachLoading(true)
    let q = supabase
      .from("coaches")
      .select("id, program_id, first_name, last_name, title, email, phone, twitter_handle, twitter_dm_open, programs(id, school_name, division, conference, logo_url)", { count: "exact" })
      .order("last_name")
      .range(page * COACH_PAGE_SIZE, (page + 1) * COACH_PAGE_SIZE - 1)

    if (query) {
      const words = query.trim().split(/\s+/)
      if (words.length >= 2) {
        q = q.or(`and(first_name.ilike.%${words[0]}%,last_name.ilike.%${words.slice(1).join(" ")}%),title.ilike.%${query}%,email.ilike.%${query}%`)
      } else {
        q = q.or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%,title.ilike.%${query}%`)
      }
    }

    const { data, count, error } = await q
    if (error) {
      console.error("Coach search error:", error)
      setCoachResults([])
      setCoachTotal(0)
    } else {
      let filtered = data || []
      if (division && division !== "ALL") {
        filtered = filtered.filter((c: any) => c.programs?.division === division)
      }
      setCoachResults(filtered)
      setCoachTotal(division && division !== "ALL" ? filtered.length : (count || 0))
    }
    setCoachLoading(false)
  }, [supabase])

  useEffect(() => {
    if (viewMode !== "coaches") return
    const timer = setTimeout(() => {
      setCoachPage(0)
      fetchCoaches(0, searchQuery, activeDivision)
    }, 300)
    return () => clearTimeout(timer)
  }, [viewMode, searchQuery, activeDivision, fetchCoaches])

  // Drill-down handlers
  const openProgram = (program: Program) => {
    setSelectedProgram(program)
    setSelectedCoach(null)
    fetchProgramCoaches(program.id)
  }

  const openCoachFromProgram = (coach: Coach) => {
    setSelectedCoach(coach)
    setCoachProgram(selectedProgram)
  }

  const openCoachDirectly = (coach: Coach) => {
    const prog = (coach as any).programs || programMap[coach.program_id]
    if (prog) {
      setSelectedProgram(prog)
      setCoachProgram(prog)
      setSelectedCoach(coach)
      fetchProgramCoaches(prog.id)
    }
  }

  const closeCoach = () => {
    setSelectedCoach(null)
    setCoachProgram(null)
  }

  const closeProgram = () => {
    setSelectedProgram(null)
    setSelectedCoach(null)
    setCoachProgram(null)
    setProgramCoaches([])
  }

  const openAddDialog = (program: Program, e: React.MouseEvent) => {
    e.stopPropagation()
    setAddDialogProgram(program)
    setAddDialogOpen(true)
  }

  const filteredPrograms = useMemo(() => {
    let result = programs
    if (activeDivision !== "ALL") result = result.filter((p) => p.division === activeDivision)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (p) =>
          p.school_name.toLowerCase().includes(q) ||
          p.conference?.toLowerCase().includes(q) ||
          p.state?.toLowerCase().includes(q)
      )
    }
    result = [...result].sort((a, b) => {
      if (sortField === "division") {
        const ao = DIVISION_ORDER[a.division] ?? 99
        const bo = DIVISION_ORDER[b.division] ?? 99
        return sortAsc ? ao - bo : bo - ao
      }
      const av = (a as any)[sortField] || ""
      const bv = (b as any)[sortField] || ""
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av)
    })
    return result
  }, [activeDivision, searchQuery, sortField, sortAsc, programs])

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      type="button"
      className="flex items-center gap-1.5 font-semibold text-foreground transition-colors hover:text-primary"
      onClick={() => handleSort(field)}
    >
      {children}
      <ArrowUpDown className={`h-3 w-3 ${sortField === field ? "text-primary" : "text-muted-foreground/50"}`} />
    </button>
  )

  const sortedCoachResults = useMemo(() => {
    return [...coachResults].sort((a, b) => {
      const progA = (a as any).programs as Program | undefined
      const progB = (b as any).programs as Program | undefined
      switch (coachSortField) {
        case "last_name": {
          const cmp = (a.last_name || "").localeCompare(b.last_name || "")
          return coachSortAsc ? cmp : -cmp
        }
        case "school_name": {
          const cmp = (progA?.school_name || "").localeCompare(progB?.school_name || "")
          return coachSortAsc ? cmp : -cmp
        }
        case "has_email": {
          const ae = a.email ? 1 : 0
          const be = b.email ? 1 : 0
          if (ae !== be) return coachSortAsc ? be - ae : ae - be
          return (a.last_name || "").localeCompare(b.last_name || "")
        }
        case "dm_open": {
          const ad = a.twitter_dm_open ? 1 : 0
          const bd = b.twitter_dm_open ? 1 : 0
          if (ad !== bd) return coachSortAsc ? bd - ad : ad - bd
          return (a.last_name || "").localeCompare(b.last_name || "")
        }
        default:
          return 0
      }
    })
  }, [coachResults, coachSortField, coachSortAsc])

  const CoachSortButton = ({ field, children }: { field: CoachSortField; children: React.ReactNode }) => (
    <button
      type="button"
      className="flex items-center gap-1.5 font-semibold text-foreground transition-colors hover:text-primary"
      onClick={() => handleCoachSort(field)}
    >
      {children}
      <ArrowUpDown className={`h-3 w-3 ${coachSortField === field ? "text-primary" : "text-muted-foreground/50"}`} />
    </button>
  )

  const coachTotalPages = Math.ceil(coachTotal / COACH_PAGE_SIZE)

  return (
    <>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-foreground sm:text-3xl">
            Programs
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Browse programs and coaching staff</p>
        </div>

        {/* Filter Bar */}
        <Card className="p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              {divisions.map((div) => (
                <button
                  key={div}
                  type="button"
                  onClick={() => setActiveDivision(div)}
                  className={`rounded-md px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${
                    activeDivision === div
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                  }`}
                >
                  {div}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <div className="relative flex-1 lg:w-72 lg:flex-initial">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={viewMode === "programs" ? "Search schools..." : "Search coaches..."}
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex shrink-0 overflow-hidden rounded-md border border-input">
                <button
                  type="button"
                  onClick={() => setViewMode("programs")}
                  className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold transition-all ${
                    viewMode === "programs"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <Building2 className="h-3.5 w-3.5" />
                  Programs
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("coaches")}
                  className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold transition-all ${
                    viewMode === "coaches"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  Coaches
                </button>
              </div>
            </div>
          </div>
        </Card>

        {/* Programs View */}
        {viewMode === "programs" ? (
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                  <TableHead className="w-[300px]"><SortButton field="school_name">School</SortButton></TableHead>
                  <TableHead><SortButton field="division">Division</SortButton></TableHead>
                  <TableHead><SortButton field="state">State</SortButton></TableHead>
                  <TableHead><SortButton field="conference">Conference</SortButton></TableHead>
                  <TableHead className="w-[140px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPrograms.map((program) => {
                  const inPipeline = pipelineProgramIds.includes(program.id)
                  return (
                    <TableRow
                      key={program.id}
                      className="group cursor-pointer transition-colors hover:bg-primary/[0.03]"
                      onClick={() => openProgram(program)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <SchoolLogo school={program.school_name} logoUrl={program.logo_url} />
                          <span className="text-sm font-semibold text-foreground group-hover:text-primary">
                            {program.school_name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${divisionColorMap[program.division] || "bg-secondary text-secondary-foreground"} rounded-md text-[10px] font-bold uppercase tracking-wider`}>
                          {program.division}
                        </Badge>
                      </TableCell>
                      <TableCell><span className="text-sm text-muted-foreground">{program.state}</span></TableCell>
                      <TableCell><span className="text-sm text-foreground">{program.conference}</span></TableCell>
                      <TableCell className="text-right">
                        {!inPipeline && (
                          <button
                            type="button"
                            onClick={(e) => openAddDialog(program, e)}
                            className="invisible inline-flex items-center gap-1 rounded-md bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-foreground transition-all hover:bg-accent/90 group-hover:visible"
                          >
                            <Plus className="h-3 w-3" />
                            Add Program
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
                {filteredPrograms.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center">
                      <p className="text-sm text-muted-foreground">No programs found matching your filters.</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between border-t bg-secondary/30 px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Showing <span className="font-semibold text-foreground">{filteredPrograms.length}</span> of{" "}
                <span className="font-semibold text-foreground">{programs.length}</span> programs
              </p>
            </div>
          </Card>
        ) : (
          /* Coaches View — paginated from API */
          <Card className="overflow-hidden">
            {coachLoading && (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="ml-2 text-sm text-muted-foreground">Loading coaches...</span>
              </div>
            )}
            {!coachLoading && (
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                    <TableHead className="w-[250px]"><CoachSortButton field="last_name">Coach</CoachSortButton></TableHead>
                    <TableHead><CoachSortButton field="school_name">School</CoachSortButton></TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead><CoachSortButton field="has_email">Email</CoachSortButton></TableHead>
                    <TableHead><CoachSortButton field="dm_open">Twitter</CoachSortButton></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedCoachResults.map((coach) => {
                    const prog = (coach as any).programs as Program | undefined
                    return (
                      <TableRow
                        key={coach.id}
                        className="group cursor-pointer transition-colors hover:bg-primary/[0.03]"
                        onClick={() => openCoachDirectly(coach)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                              {coach.first_name?.[0]}{coach.last_name?.[0]}
                            </div>
                            <span className="text-sm font-semibold text-foreground group-hover:text-primary">
                              {coach.first_name} {coach.last_name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {prog && <SchoolLogo school={prog.school_name} logoUrl={prog.logo_url} />}
                            <span className="text-sm text-foreground">{prog?.school_name || "—"}</span>
                          </div>
                        </TableCell>
                        <TableCell><span className="text-sm text-muted-foreground">{coach.title || "—"}</span></TableCell>
                        <TableCell>
                          {coach.email ? (
                            <span className="text-sm text-primary">{coach.email}</span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          {coach.twitter_handle ? (
                            <div className="flex items-center gap-1">
                              <span className="text-sm text-primary">@{coach.twitter_handle}</span>
                              {coach.twitter_dm_open && (
                                <Badge variant="secondary" className="text-[9px]">DM Open</Badge>
                              )}
                            </div>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {coachResults.length === 0 && !coachLoading && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center">
                        <p className="text-sm text-muted-foreground">No coaches found matching your filters.</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
            <div className="flex items-center justify-between border-t bg-secondary/30 px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Showing <span className="font-semibold text-foreground">{coachResults.length}</span> of{" "}
                <span className="font-semibold text-foreground">{coachTotal.toLocaleString()}</span> coaches
              </p>
              {coachTotalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={coachPage === 0}
                    onClick={() => { const p = coachPage - 1; setCoachPage(p); fetchCoaches(p, searchQuery, activeDivision) }}
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-input bg-card text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-30"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-xs text-muted-foreground">
                    Page {coachPage + 1} of {coachTotalPages}
                  </span>
                  <button
                    type="button"
                    disabled={coachPage >= coachTotalPages - 1}
                    onClick={() => { const p = coachPage + 1; setCoachPage(p); fetchCoaches(p, searchQuery, activeDivision) }}
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-input bg-card text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-30"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>

      {/* Program Detail Overlay */}
      {selectedProgram && (
        <ProgramDetail
          program={selectedProgram}
          coaches={programCoaches}
          onBack={closeProgram}
          onSelectCoach={openCoachFromProgram}
          pipelineProgramIds={pipelineProgramIds}
          pipelineStages={pipelineStages}
          onPipelineAdded={refreshPipelineEntries}
        />
      )}

      {/* Coach Detail Panel */}
      {selectedCoach && coachProgram && (
        <CoachDetail
          coach={selectedCoach}
          program={coachProgram}
          onClose={closeCoach}
        />
      )}

      {/* Loading overlay for program coaches */}
      {loadingCoaches && selectedProgram && (
        <div className="fixed inset-0 z-[59] flex items-center justify-center bg-background/80">
          <div className="flex items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-sm font-medium text-foreground">Loading coaching staff...</span>
          </div>
        </div>
      )}

      {/* Add to Pipeline Dialog */}
      {addDialogProgram && (
        <AddToPipelineDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          programId={addDialogProgram.id}
          programName={addDialogProgram.school_name}
          stages={pipelineStages}
          onAdded={refreshPipelineEntries}
        />
      )}
    </>
  )
}
