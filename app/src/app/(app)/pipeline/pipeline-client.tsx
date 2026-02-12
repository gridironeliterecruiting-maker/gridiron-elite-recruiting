"use client"

import React, { useState, useCallback } from "react"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, GripVertical, X, ArrowRight } from "lucide-react"
import { useRef as useRefTouch } from "react"
import { ProgramDetail } from "@/components/programs/program-detail"
import { CoachDetail } from "@/components/programs/coach-detail"

const STAGE_COLORS = [
  "bg-primary/10 border-primary/30 text-primary",
  "bg-blue-50 border-blue-300 text-blue-700",
  "bg-amber-50 border-amber-300 text-amber-700",
  "bg-emerald-50 border-emerald-300 text-emerald-700",
  "bg-purple-50 border-purple-300 text-purple-700",
  "bg-accent/10 border-accent/30 text-accent",
]

interface Stage {
  id: string
  name: string
  display_order: number
}

interface ProgramData {
  id: string
  school_name: string
  division: string
  conference: string
  logo_url: string | null
  website?: string | null
  state?: string
  city?: string
  espn_id?: number | null
}

interface CoachData {
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

interface PipelineEntry {
  id: string
  program_id: string
  stage_id: string
  status: string | null
  notes: string | null
  programs: ProgramData | ProgramData[] | null
}

function getProgram(entry: PipelineEntry): ProgramData | null {
  if (!entry.programs) return null
  if (Array.isArray(entry.programs)) return entry.programs[0] || null
  return entry.programs
}

function ProgramLogo({ program }: { program: ProgramData | null }) {
  if (program?.logo_url) {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-primary/20 overflow-hidden">
        <Image src={program.logo_url} alt={program.school_name} width={36} height={36} className="object-contain" />
      </div>
    )
  }
  const initials = program?.school_name?.slice(0, 3).toUpperCase() || "???"
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary ring-1 ring-primary/20">
      {initials}
    </div>
  )
}

export function PipelineClient({
  stages,
  entries: initialEntries,
  allPrograms,
}: {
  stages: Stage[]
  entries: PipelineEntry[]
  allPrograms: ProgramData[]
}) {
  const [entries, setEntries] = useState(initialEntries)
  const [draggedCard, setDraggedCard] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [selectedProgram, setSelectedProgram] = useState("")
  const [selectedStage, setSelectedStage] = useState(stages[0]?.id || "")

  // Drill-down state
  const [detailProgram, setDetailProgram] = useState<ProgramData | null>(null)
  const [detailCoach, setDetailCoach] = useState<CoachData | null>(null)
  const [coachProgram, setCoachProgram] = useState<ProgramData | null>(null)
  const [programCoaches, setProgramCoaches] = useState<CoachData[]>([])
  const [touchDragging, setTouchDragging] = useState<string | null>(null)
  const touchTimerRef = useRefTouch<ReturnType<typeof setTimeout> | null>(null)
  const touchStartPos = useRefTouch<{ x: number; y: number } | null>(null)

  // Fetch coaches on demand when a program is opened
  const fetchCoachesForProgram = React.useCallback(async (programId: string) => {
    try {
      const res = await fetch(`/api/programs/${programId}/coaches`)
      if (res.ok) {
        const data = await res.json()
        setProgramCoaches(data)
      }
    } catch { /* ignore */ }
  }, [])

  const programMap = React.useMemo(() => {
    const map: Record<string, ProgramData> = {}
    for (const p of allPrograms) map[p.id] = p
    return map
  }, [allPrograms])

  const openProgramDetail = (program: ProgramData) => {
    setDetailProgram(program)
    setDetailCoach(null)
    setProgramCoaches([])
    fetchCoachesForProgram(program.id)
  }

  const openCoachFromProgram = (coach: CoachData) => {
    setDetailCoach(coach)
    setCoachProgram(detailProgram)
  }

  const closeProgramDetail = () => {
    setDetailProgram(null)
    setDetailCoach(null)
    setCoachProgram(null)
  }

  const closeCoachDetail = () => {
    setDetailCoach(null)
    setCoachProgram(null)
  }

  const supabase = createClient()

  const getStageEntries = useCallback(
    (stageId: string) => entries.filter((e) => e.stage_id === stageId),
    [entries]
  )

  const moveEntry = async (entryId: string, newStageId: string) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, stage_id: newStageId } : e))
    )
    await supabase.from("pipeline_entries").update({ stage_id: newStageId }).eq("id", entryId)
  }

  const handleDragStart = (e: React.DragEvent, entryId: string) => {
    setDraggedCard(entryId)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOverStage(stageId)
  }

  const handleDrop = (e: React.DragEvent, targetStage: string) => {
    e.preventDefault()
    if (draggedCard) moveEntry(draggedCard, targetStage)
    setDraggedCard(null)
    setDragOverStage(null)
  }

  const handleDragEnd = () => {
    setDraggedCard(null)
    setDragOverStage(null)
  }

  const moveCardDirection = (entryId: string, direction: "left" | "right") => {
    const entry = entries.find((e) => e.id === entryId)
    if (!entry) return
    const currentIdx = stages.findIndex((s) => s.id === entry.stage_id)
    const newIdx = direction === "right" ? currentIdx + 1 : currentIdx - 1
    if (newIdx < 0 || newIdx >= stages.length) return
    moveEntry(entryId, stages[newIdx].id)
  }

  const removeEntry = async (entryId: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== entryId))
    await supabase.from("pipeline_entries").delete().eq("id", entryId)
  }

  const addProgram = async () => {
    if (!selectedProgram || !selectedStage) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data, error } = await supabase
      .from("pipeline_entries")
      .insert({ program_id: selectedProgram, stage_id: selectedStage, athlete_id: user.id })
      .select("id, program_id, stage_id, status, notes, programs(id, school_name, division, conference, logo_url)")
      .single()
    if (data && !error) {
      setEntries((prev) => [...prev, data as PipelineEntry])
    }
    setSelectedProgram("")
    setSelectedStage(stages[0]?.id || "")
    setAddDialogOpen(false)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-foreground sm:text-3xl">
            Pipeline
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Drag programs between stages to track progress
          </p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Plus className="h-4 w-4" />
              Add Program
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Program to Pipeline</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 pt-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-foreground">Program</label>
                <Select value={selectedProgram} onValueChange={setSelectedProgram}>
                  <SelectTrigger><SelectValue placeholder="Select a program" /></SelectTrigger>
                  <SelectContent>
                    {allPrograms.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.school_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-foreground">Starting Stage</label>
                <Select value={selectedStage} onValueChange={setSelectedStage}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {stages.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={addProgram} className="bg-accent text-accent-foreground hover:bg-accent/90">
                Add to Pipeline
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-5 gap-1.5 md:gap-3 pb-4">
        {stages.map((stage, idx) => {
          const stageEntries = getStageEntries(stage.id)
          const isOver = dragOverStage === stage.id
          const color = STAGE_COLORS[idx % STAGE_COLORS.length]

          return (
            <div
              key={stage.id}
              data-stage-id={stage.id}
              className="flex min-w-0 flex-col"
              onDragOver={(e) => handleDragOver(e, stage.id)}
              onDragLeave={() => setDragOverStage(null)}
              onDrop={(e) => handleDrop(e, stage.id)}
            >
              <div className={`mb-2 md:mb-3 flex items-center justify-center md:justify-between rounded-lg border px-1.5 md:px-3 py-1.5 md:py-2.5 ${color}`}>
                <span className="text-[8px] md:text-xs font-bold uppercase tracking-wider text-center md:text-left">
                  {["Contact", "Evaluation", "Interest", "Visit", "Offer"][idx] || stage.name}
                </span>
                <Badge variant="secondary" className="hidden md:flex h-5 min-w-[20px] justify-center rounded-md px-1.5 text-[10px] font-bold">
                  {stageEntries.length}
                </Badge>
              </div>

              <div
                className={`flex min-h-[200px] md:min-h-[400px] flex-1 flex-col gap-1.5 md:gap-2.5 rounded-lg border-2 border-dashed p-1 md:p-2.5 transition-colors ${
                  isOver ? "border-primary/40 bg-primary/5" : "border-transparent bg-secondary/30"
                }`}
              >
                {stageEntries.map((entry) => {
                  const program = getProgram(entry)
                  const stageIdx = stages.findIndex((s) => s.id === entry.stage_id)

                  const handleTouchStart = (e: React.TouchEvent) => {
                    const touch = e.touches[0]
                    touchStartPos.current = { x: touch.clientX, y: touch.clientY }
                    touchTimerRef.current = setTimeout(() => {
                      setTouchDragging(entry.id)
                      setDraggedCard(entry.id)
                    }, 500)
                  }

                  const handleTouchMove = (e: React.TouchEvent) => {
                    if (touchTimerRef.current && touchStartPos.current) {
                      const touch = e.touches[0]
                      const dx = Math.abs(touch.clientX - touchStartPos.current.x)
                      const dy = Math.abs(touch.clientY - touchStartPos.current.y)
                      if (dx > 10 || dy > 10) {
                        clearTimeout(touchTimerRef.current)
                        touchTimerRef.current = null
                      }
                    }
                    if (touchDragging === entry.id) {
                      e.preventDefault()
                      // Find which stage column we're over
                      const touch = e.touches[0]
                      const el = document.elementFromPoint(touch.clientX, touch.clientY)
                      const stageCol = el?.closest("[data-stage-id]")
                      if (stageCol) {
                        const sid = stageCol.getAttribute("data-stage-id")
                        if (sid) setDragOverStage(sid)
                      }
                    }
                  }

                  const handleTouchEnd = () => {
                    if (touchTimerRef.current) {
                      clearTimeout(touchTimerRef.current)
                      touchTimerRef.current = null
                      // It was a tap, open program detail
                      if (program) {
                        const fullProgram = programMap[program.id] || program
                        openProgramDetail(fullProgram)
                      }
                    }
                    if (touchDragging === entry.id && dragOverStage) {
                      moveEntry(entry.id, dragOverStage)
                    }
                    setTouchDragging(null)
                    setDraggedCard(null)
                    setDragOverStage(null)
                    touchStartPos.current = null
                  }

                  return (
                    <div
                      key={entry.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, entry.id)}
                      onDragEnd={handleDragEnd}
                      onTouchStart={handleTouchStart}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                      className={`group cursor-grab rounded-lg border bg-card shadow-sm transition-all hover:shadow-md active:cursor-grabbing ${
                        draggedCard === entry.id ? "opacity-50 ring-2 ring-primary" : ""
                      }`}
                    >
                      {/* Mobile: logo-only square */}
                      <div
                        className="flex md:hidden items-center justify-center p-1"
                        onClick={() => {
                          if (program) {
                            const fullProgram = programMap[program.id] || program
                            openProgramDetail(fullProgram)
                          }
                        }}
                      >
                        <div className="flex h-14 w-14 items-center justify-center">
                          {program?.logo_url ? (
                            <Image src={program.logo_url} alt={program.school_name || ""} width={44} height={44} className="object-contain" />
                          ) : (
                            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                              {program?.school_name?.slice(0, 3).toUpperCase() || "???"}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Desktop: full card */}
                      <div className="hidden md:block p-3">
                        <div className="flex items-start gap-2.5">
                          <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/30 transition-colors group-hover:text-muted-foreground" />
                          <button
                            type="button"
                            className="group/prog flex min-w-0 flex-1 items-start gap-2.5 text-left rounded-md -m-1.5 p-1.5 transition-all hover:bg-primary/5 hover:ring-1 hover:ring-primary/20"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (program) {
                                const fullProgram = programMap[program.id] || program
                                openProgramDetail(fullProgram)
                              }
                            }}
                            title={program ? `View ${program.school_name} details` : undefined}
                          >
                          <ProgramLogo program={program} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-foreground truncate transition-colors group-hover/prog:text-primary">
                              {program?.school_name || "Unknown"}
                            </p>
                            {program?.division && (
                              <p className="text-[11px] text-muted-foreground transition-colors group-hover/prog:text-primary/70">
                                {program.division}{program.conference ? ` - ${program.conference}` : ""}
                              </p>
                            )}
                            {entry.notes && (
                              <p className="mt-1.5 rounded bg-secondary/80 px-2 py-1 text-[10px] text-muted-foreground">
                                {entry.notes}
                              </p>
                            )}
                          </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => removeEntry(entry.id)}
                            className="shrink-0 rounded p-0.5 text-muted-foreground/0 transition-colors hover:text-accent group-hover:text-muted-foreground/50"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="mt-2 flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          {stageIdx > 0 && (
                            <button
                              type="button"
                              onClick={() => moveCardDirection(entry.id, "left")}
                              className="flex items-center rounded bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                            >
                              <ArrowRight className="mr-0.5 h-3 w-3 rotate-180" />
                              Back
                            </button>
                          )}
                          {stageIdx < stages.length - 1 && (
                            <button
                              type="button"
                              onClick={() => moveCardDirection(entry.id, "right")}
                              className="flex items-center rounded bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary transition-colors hover:bg-primary/20"
                            >
                              Advance
                              <ArrowRight className="ml-0.5 h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}

                {stageEntries.length === 0 && !isOver && (
                  <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
                    <p className="text-xs text-muted-foreground/50">Drop programs here</p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Program Detail Overlay */}
      {detailProgram && (
        <ProgramDetail
          program={detailProgram}
          coaches={programCoaches}
          onBack={closeProgramDetail}
          onSelectCoach={openCoachFromProgram}
          pipelineProgramIds={entries.map(e => e.program_id)}
          pipelineStages={stages}
        />
      )}

      {/* Coach Detail Panel */}
      {detailCoach && coachProgram && (
        <CoachDetail
          coach={detailCoach}
          program={coachProgram}
          onClose={closeCoachDetail}
        />
      )}
    </div>
  )
}
