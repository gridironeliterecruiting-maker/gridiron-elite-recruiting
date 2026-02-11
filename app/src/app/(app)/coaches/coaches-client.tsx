"use client"

import React, { useState, useMemo } from "react"
import Image from "next/image"
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
import { Search, ArrowUpDown, Users, Building2 } from "lucide-react"
import { ProgramDetail } from "@/components/programs/program-detail"
import { CoachDetail } from "@/components/programs/coach-detail"

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

type SortField = "school_name" | "division" | "conference" | "state" | "coaches"

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

export function CoachesClient({ programs, coaches }: { programs: Program[]; coaches: Coach[] }) {
  const [activeDivision, setActiveDivision] = useState<Division>("ALL")
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<"programs" | "coaches">("programs")
  const [sortField, setSortField] = useState<SortField>("school_name")
  const [sortAsc, setSortAsc] = useState(true)

  // Drill-down state
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null)
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null)
  const [coachProgram, setCoachProgram] = useState<Program | null>(null)

  const coachCountMap = useMemo(() => {
    const map: Record<string, number> = {}
    for (const c of coaches) {
      map[c.program_id] = (map[c.program_id] || 0) + 1
    }
    return map
  }, [coaches])

  const programMap = useMemo(() => {
    const map: Record<string, Program> = {}
    for (const p of programs) map[p.id] = p
    return map
  }, [programs])

  const coachesByProgram = useMemo(() => {
    const map: Record<string, Coach[]> = {}
    for (const c of coaches) {
      if (!map[c.program_id]) map[c.program_id] = []
      map[c.program_id].push(c)
    }
    return map
  }, [coaches])

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(!sortAsc)
    else { setSortField(field); setSortAsc(true) }
  }

  // Drill-down handlers
  const openProgram = (program: Program) => {
    setSelectedProgram(program)
    setSelectedCoach(null)
  }

  const openCoachFromProgram = (coach: Coach) => {
    setSelectedCoach(coach)
    setCoachProgram(selectedProgram)
  }

  const openCoachDirectly = (coach: Coach) => {
    const parentProgram = programMap[coach.program_id]
    if (parentProgram) {
      setSelectedProgram(parentProgram)
      setCoachProgram(parentProgram)
      setSelectedCoach(coach)
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
      if (sortField === "coaches") {
        const av = coachCountMap[a.id] || 0
        const bv = coachCountMap[b.id] || 0
        return sortAsc ? av - bv : bv - av
      }
      const av = (a as any)[sortField] || ""
      const bv = (b as any)[sortField] || ""
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av)
    })
    return result
  }, [activeDivision, searchQuery, sortField, sortAsc, programs, coachCountMap])

  const filteredCoaches = useMemo(() => {
    let result = coaches
    if (activeDivision !== "ALL") {
      const progIds = new Set(programs.filter((p) => p.division === activeDivision).map((p) => p.id))
      result = result.filter((c) => progIds.has(c.program_id))
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter((c) => {
        const prog = programMap[c.program_id]
        return (
          `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
          c.title?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          prog?.school_name.toLowerCase().includes(q)
        )
      })
    }
    return result
  }, [activeDivision, searchQuery, coaches, programs, programMap])

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
                  placeholder="Search schools, coaches, states..."
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
                  <TableHead><SortButton field="conference">Conference</SortButton></TableHead>
                  <TableHead><SortButton field="state">State</SortButton></TableHead>
                  <TableHead className="text-right"><SortButton field="coaches">Coaches</SortButton></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPrograms.map((program) => (
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
                    <TableCell><span className="text-sm text-foreground">{program.conference}</span></TableCell>
                    <TableCell><span className="text-sm text-muted-foreground">{program.state}</span></TableCell>
                    <TableCell className="text-right">
                      <span className="font-display text-sm font-bold text-foreground">
                        {coachCountMap[program.id] || 0}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
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
              <p className="text-xs text-muted-foreground">
                Total coaches: <span className="font-semibold text-foreground">{coaches.length}</span>
              </p>
            </div>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                  <TableHead className="w-[250px]">Coach</TableHead>
                  <TableHead>School</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Twitter</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCoaches.map((coach) => {
                  const prog = programMap[coach.program_id]
                  return (
                    <TableRow
                      key={coach.id}
                      className="group cursor-pointer transition-colors hover:bg-primary/[0.03]"
                      onClick={() => openCoachDirectly(coach)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                            {coach.first_name[0]}{coach.last_name[0]}
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
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        {coach.twitter_handle ? (
                          <div className="flex items-center gap-1">
                            <span className="text-sm text-primary">@{coach.twitter_handle}</span>
                            {coach.twitter_dm_open && (
                              <Badge variant="secondary" className="text-[9px]">DM Open</Badge>
                            )}
                          </div>
                        ) : "—"}
                      </TableCell>
                    </TableRow>
                  )
                })}
                {filteredCoaches.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center">
                      <p className="text-sm text-muted-foreground">No coaches found matching your filters.</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between border-t bg-secondary/30 px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Showing <span className="font-semibold text-foreground">{filteredCoaches.length}</span> of{" "}
                <span className="font-semibold text-foreground">{coaches.length}</span> coaches
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* Program Detail Overlay */}
      {selectedProgram && (
        <ProgramDetail
          program={selectedProgram}
          coaches={coachesByProgram[selectedProgram.id] || []}
          onBack={closeProgram}
          onSelectCoach={openCoachFromProgram}
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
    </>
  )
}
