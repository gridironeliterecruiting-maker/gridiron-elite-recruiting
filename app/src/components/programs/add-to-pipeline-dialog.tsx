"use client"

import React, { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Stage {
  id: string
  name: string
  display_order: number
}

interface AddToPipelineDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  programId: string
  programName: string
  stages: Stage[]
  onAdded?: () => void
}

export function AddToPipelineDialog({
  open,
  onOpenChange,
  programId,
  programName,
  stages,
  onAdded,
}: AddToPipelineDialogProps) {
  const initialStage = stages.find(s => s.name === "Initial Contact")?.id || stages[0]?.id || ""
  const [selectedStage, setSelectedStage] = useState(initialStage)
  const [loading, setLoading] = useState(false)

  // Reset to Initial Contact every time dialog opens
  useEffect(() => {
    if (open) {
      setSelectedStage(stages.find(s => s.name === "Initial Contact")?.id || stages[0]?.id || "")
    }
  }, [open, stages])

  const handleAdd = async () => {
    if (!selectedStage) return
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { error } = await supabase
      .from("pipeline_entries")
      .insert({ program_id: programId, stage_id: selectedStage, athlete_id: user.id })
    setLoading(false)
    if (!error) {
      onOpenChange(false)
      onAdded?.()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Program to Pipeline</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 pt-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground">Program</label>
            <div className="rounded-md border border-input bg-secondary/50 px-3 py-2 text-sm text-foreground">
              {programName}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground">Starting Stage</label>
            <Select value={selectedStage} onValueChange={setSelectedStage}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="z-[200]">
                {stages.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleAdd} disabled={loading} className="bg-accent text-accent-foreground hover:bg-accent/90">
            {loading ? "Adding..." : "Add to Pipeline"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
