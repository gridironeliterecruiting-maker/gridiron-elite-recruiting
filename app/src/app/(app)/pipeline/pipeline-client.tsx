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
  allCoaches,
}: {
  stages: Stage[]
  entries: PipelineEntry[]
  allPrograms: ProgramData[]
  allCoaches: CoachData[]
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

  const coachesByProgram = React.useMemo(() => {
    const map: Record<string, CoachData[]> = {}
    for (const c of allCoaches) {
      if (!map[c.program_id]) map[c.program_id] = []
      map[c.program_id].push(c)
    }
    return map
  }, [allCoaches])

  const programMap = React.useMemo(() => {
    const map: Record<string, ProgramData> = {}
    for (const p of allPrograms) map[p.id] = p
    return map
  }, [allPrograms])

  const openProgramDetail = (program: ProgramData) => {
    setDetailProgram(program)
    setDetailCoach(null)
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
      <div className="grid grid-cols-5 gap-3 pb-4">
        {stages.map((stage, idx) => {
          const stageEntries = getStageEntries(stage.id)
          const isOver = dragOverStage === stage.id
          const color = STAGE_COLORS[idx % STAGE_COLORS.length]

          return (
            <div
              key={stage.id}
              className="flex min-w-0 flex-col"
              onDragOver={(e) => handleDragOver(e, stage.id)}
              onDragLeave={() => setDragOverStage(null)}
              onDrop={(e) => handleDrop(e, stage.id)}
            >
              <div className={`mb-3 flex items-center justify-between rounded-lg border px-3 py-2.5 ${color}`}>
                <span className="text-xs font-bold uppercase tracking-wider">{stage.name}</span>
                <Badge variant="secondary" className="h-5 min-w-[20px] justify-center rounded-md px-1.5 text-[10px] font-bold">
                  {stageEntries.length}
                </Badge>
              </div>

              <div
                className={`flex min-h-[400px] flex-1 flex-col gap-2.5 rounded-lg border-2 border-dashed p-2.5 transition-colors ${
                  isOver ? "border-primary/40 bg-primary/5" : "border-transparent bg-secondary/30"
                }`}
              >
                {stageEntries.map((entry) => {
                  const program = getProgram(entry)
                  const stageIdx = stages.findIndex((s) => s.id === entry.stage_id)

                  return (
                    <div
                      key={entry.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, entry.id)}
                      onDragEnd={handleDragEnd}
                      className={`group cursor-grab rounded-lg border bg-card p-3 shadow-sm transition-all hover:shadow-md active:cursor-grabbing ${
                        draggedCard === entry.id ? "opacity-50" : ""
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/30 transition-colors group-hover:text-muted-foreground" />
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (program) {
                              const fullProgram = programMap[program.id] || program
                              openProgramDetail(fullProgram)
                            }
                          }}
                        >
                        <ProgramLogo program={program} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground truncate hover:text-primary transition-colors">
                            {program?.school_name || "Unknown"}
                          </p>
                          {program?.division && (
                            <p className="text-[11px] text-muted-foreground">
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
          coaches={coachesByProgram[detailProgram.id] || []}
          onBack={closeProgramDetail}
          onSelectCoach={openCoachFromProgram}
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
