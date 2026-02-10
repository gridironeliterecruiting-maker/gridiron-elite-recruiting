'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useDroppable } from '@dnd-kit/core'

interface Stage {
  id: string
  name: string
  order_index: number
}

interface PipelineEntry {
  id: string
  program_id: string
  stage_id: string
  status: string
  notes: string
  created_at: string
  programs: { school: string; division: string } | null
  coaches_primary?: { first_name: string; last_name: string } | null
  last_interaction?: string | null
}

function DroppableColumn({ stage, entries, onCardClick }: { stage: Stage; entries: PipelineEntry[]; onCardClick: (e: PipelineEntry) => void }) {
  const { setNodeRef } = useDroppable({ id: stage.id })

  return (
    <div ref={setNodeRef} className="bg-gray-50 rounded-xl p-3 min-w-[260px] w-[260px] shrink-0 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-700">{stage.name}</h3>
        <span className="text-xs bg-[#0047AB] text-white rounded-full px-2 py-0.5">{entries.length}</span>
      </div>
      <SortableContext items={entries.map(e => e.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 flex-1 min-h-[100px]">
          {entries.map(entry => (
            <SortableCard key={entry.id} entry={entry} onClick={() => onCardClick(entry)} />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}

function SortableCard({ entry, onClick }: { entry: PipelineEntry; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id, data: { stageId: entry.stage_id } })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}
      onClick={onClick}
      className="bg-white rounded-lg border border-gray-200 p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition shadow-sm">
      <div className="font-medium text-sm text-gray-900">{entry.programs?.school || 'Unknown'}</div>
      {entry.programs?.division && <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-[#0047AB] rounded mt-1 inline-block">{entry.programs.division}</span>}
      {entry.status && <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded mt-1 ml-1 inline-block">{entry.status}</span>}
      {entry.notes && <div className="text-xs text-gray-400 mt-1 truncate">{entry.notes}</div>}
    </div>
  )
}

function CardOverlay({ entry }: { entry: PipelineEntry }) {
  return (
    <div className="bg-white rounded-lg border-2 border-[#0047AB] p-3 shadow-xl w-[240px]">
      <div className="font-medium text-sm text-gray-900">{entry.programs?.school || 'Unknown'}</div>
    </div>
  )
}

function DetailModal({ entry, onClose, onSave }: { entry: PipelineEntry; onClose: () => void; onSave: (notes: string) => void }) {
  const [notes, setNotes] = useState(entry.notes || '')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 mx-4" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-900 mb-1">{entry.programs?.school}</h2>
        <p className="text-sm text-gray-500 mb-4">{entry.programs?.division}</p>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0047AB] outline-none" />
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button onClick={() => onSave(notes)} className="px-4 py-2 text-sm bg-[#0047AB] text-white rounded-lg hover:bg-[#003a8c]">Save</button>
        </div>
      </div>
    </div>
  )
}

export default function PipelinePage() {
  const [stages, setStages] = useState<Stage[]>([])
  const [entries, setEntries] = useState<PipelineEntry[]>([])
  const [activeEntry, setActiveEntry] = useState<PipelineEntry | null>(null)
  const [detailEntry, setDetailEntry] = useState<PipelineEntry | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [programs, setPrograms] = useState<{ id: string; school: string }[]>([])
  const supabase = createClient()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const fetchData = useCallback(async () => {
    const [{ data: stageData }, { data: entryData }] = await Promise.all([
      supabase.from('pipeline_stages').select('*').order('order_index'),
      supabase.from('pipeline_entries').select('id, program_id, stage_id, status, notes, created_at, programs(school, division)'),
    ])
    setStages(stageData || [])
    setEntries((entryData as unknown as PipelineEntry[]) || [])
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  const handleDragStart = (event: DragStartEvent) => {
    const entry = entries.find(e => e.id === event.active.id)
    if (entry) setActiveEntry(entry)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveEntry(null)
    const { active, over } = event
    if (!over) return

    const entryId = active.id as string
    // over.id could be a stage id or another card id
    let newStageId = over.id as string
    const isStage = stages.some(s => s.id === newStageId)
    if (!isStage) {
      const overEntry = entries.find(e => e.id === newStageId)
      if (overEntry) newStageId = overEntry.stage_id
      else return
    }

    setEntries(prev => prev.map(e => e.id === entryId ? { ...e, stage_id: newStageId } : e))
    await supabase.from('pipeline_entries').update({ stage_id: newStageId }).eq('id', entryId)
  }

  const handleSaveNotes = async (notes: string) => {
    if (!detailEntry) return
    await supabase.from('pipeline_entries').update({ notes }).eq('id', detailEntry.id)
    setEntries(prev => prev.map(e => e.id === detailEntry.id ? { ...e, notes } : e))
    setDetailEntry(null)
  }

  const handleAddProgram = async (programId: string) => {
    if (!stages.length) return
    await supabase.from('pipeline_entries').insert({ program_id: programId, stage_id: stages[0].id })
    setShowAdd(false)
    fetchData()
  }

  const loadPrograms = async () => {
    const { data } = await supabase.from('programs').select('id, school').order('school').limit(100)
    setPrograms(data || [])
    setShowAdd(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CRM Pipeline</h1>
          <p className="text-gray-500 mt-1">Drag programs between stages to track progress</p>
        </div>
        <button onClick={loadPrograms}
          className="px-4 py-2 bg-[#E31937] text-white font-medium rounded-lg hover:bg-[#c91530] transition text-sm">
          + Add Program
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map(stage => (
            <DroppableColumn
              key={stage.id}
              stage={stage}
              entries={entries.filter(e => e.stage_id === stage.id)}
              onCardClick={setDetailEntry}
            />
          ))}
        </div>
        <DragOverlay>{activeEntry && <CardOverlay entry={activeEntry} />}</DragOverlay>
      </DndContext>

      {detailEntry && <DetailModal entry={detailEntry} onClose={() => setDetailEntry(null)} onSave={handleSaveNotes} />}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 mx-4 max-h-[70vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Add Program to Pipeline</h2>
            <div className="space-y-1">
              {programs.map(p => (
                <button key={p.id} onClick={() => handleAddProgram(p.id)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 rounded-lg transition">
                  {p.school}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
