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
  display_order: number
}

interface PipelineEntry {
  id: string
  program_id: string
  stage_id: string
  status: string
  notes: string
  created_at: string
  programs: { school_name: string; division: string; logo_url: string | null } | null
  coaches_primary?: { first_name: string; last_name: string } | null
  last_interaction?: string | null
}

// Hash a string to a consistent color
function hashColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 65%, 45%)`
}

// Get initials from school name
function getInitials(school: string): string {
  return school.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 3)
}

function TeamCircle({ school, logoUrl, size = 32 }: { school: string; logoUrl?: string | null; size?: number }) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={school}
        className="rounded-full object-contain shrink-0 bg-white"
        style={{ width: size, height: size }}
      />
    )
  }
  const color = hashColor(school)
  const initials = getInitials(school)
  const fontSize = size < 40 ? 'text-xs' : size < 60 ? 'text-sm' : 'text-2xl'
  return (
    <div
      className={`rounded-full flex items-center justify-center text-white font-bold shrink-0 ${fontSize}`}
      style={{ width: size, height: size, backgroundColor: color }}
    >
      {initials}
    </div>
  )
}

function DroppableColumn({ stage, entries, onCardClick }: { stage: Stage; entries: PipelineEntry[]; onCardClick: (e: PipelineEntry) => void }) {
  const { setNodeRef } = useDroppable({ id: stage.id })

  return (
    <div ref={setNodeRef} className="bg-gray-50 rounded-xl p-3 min-w-[280px] w-[280px] shrink-0 flex flex-col">
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
  const [showTooltip, setShowTooltip] = useState(false)
  const school = entry.programs?.school_name || 'Unknown'
  const logoUrl = entry.programs?.logo_url

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}
      onClick={onClick}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      className="relative bg-white rounded-lg border border-gray-200 p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition shadow-sm flex items-start gap-3">
      <TeamCircle school={school} logoUrl={logoUrl} size={36} />
      <div className="min-w-0 flex-1">
        <div className="font-medium text-sm text-gray-900">{school}</div>
        <div className="flex flex-wrap gap-1 mt-1">
          {entry.programs?.division && <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-[#0047AB] rounded">{entry.programs.division}</span>}
          {entry.status && <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{entry.status}</span>}
        </div>
        {entry.notes && <div className="text-xs text-gray-400 mt-1 truncate">{entry.notes}</div>}
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute left-full ml-2 top-0 z-50 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl w-56 pointer-events-none">
          <div className="font-bold mb-1">{school}</div>
          {entry.programs?.division && <div>Division: {entry.programs.division}</div>}
          {entry.status && <div>Status: {entry.status}</div>}
          {entry.notes && <div className="mt-1 text-gray-300">{entry.notes}</div>}
        </div>
      )}
    </div>
  )
}

function CardOverlay({ entry }: { entry: PipelineEntry }) {
  const school = entry.programs?.school_name || 'Unknown'
  const logoUrl = entry.programs?.logo_url
  return (
    <div className="bg-white rounded-lg border-2 border-[#0047AB] p-3 shadow-xl w-[260px] flex items-center gap-3">
      <TeamCircle school={school} logoUrl={logoUrl} size={36} />
      <div className="font-medium text-sm text-gray-900">{school}</div>
    </div>
  )
}

function DetailView({ entry, stages, onClose, onSave }: { entry: PipelineEntry; stages: Stage[]; onClose: () => void; onSave: (notes: string) => void }) {
  const [notes, setNotes] = useState(entry.notes || '')
  const [saving, setSaving] = useState(false)
  const school = entry.programs?.school_name || 'Unknown'
  const logoUrl = entry.programs?.logo_url
  const stage = stages.find(s => s.id === entry.stage_id)

  const handleSave = async () => {
    setSaving(true)
    await onSave(notes)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#003080] via-[#0047AB] to-[#0055CC] text-white">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <button onClick={onClose} className="flex items-center gap-2 text-blue-200 hover:text-white mb-4 transition text-sm">
            <span className="text-xl">←</span> Back to Pipeline
          </button>
          <div className="flex items-center gap-5">
            <TeamCircle school={school} logoUrl={logoUrl} size={80} />
            <div>
              <h1 className="text-2xl font-bold">{school}</h1>
              <div className="flex items-center gap-3 mt-1 text-blue-200 text-sm">
                {entry.programs?.division && <span>{entry.programs.division}</span>}
                {stage && <span>• {stage.name}</span>}
                {entry.status && <span>• {entry.status}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <InfoCard label="Division" value={entry.programs?.division || '—'} />
          <InfoCard label="Stage" value={stage?.name || '—'} />
          <InfoCard label="Status" value={entry.status || '—'} />
        </div>

        {/* Notes */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-bold text-gray-700 mb-3">Notes</h2>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={5}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0047AB] outline-none" />
          <div className="flex justify-end mt-3">
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 text-sm bg-[#0047AB] text-white rounded-lg hover:bg-[#003a8c] disabled:opacity-50 transition">
              {saving ? 'Saving...' : 'Save Notes'}
            </button>
          </div>
        </div>

        {/* Activity Timeline */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-bold text-gray-700 mb-3">Activity Timeline</h2>
          <div className="space-y-3">
            <TimelineItem date={entry.created_at} text="Added to pipeline" />
            {entry.stage_id && <TimelineItem date={entry.created_at} text={`Moved to ${stage?.name || 'current stage'}`} />}
          </div>
        </div>

        {/* Coaching Staff Placeholder */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-gray-700 mb-3">Coaching Staff</h2>
          <p className="text-sm text-gray-400 italic">No coaching staff linked yet. Add contacts from the Coach Database.</p>
        </div>
      </div>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-sm font-semibold text-gray-900">{value}</div>
    </div>
  )
}

function TimelineItem({ date, text }: { date: string; text: string }) {
  const formatted = new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return (
    <div className="flex items-start gap-3">
      <div className="w-2 h-2 bg-[#0047AB] rounded-full mt-1.5 shrink-0" />
      <div>
        <div className="text-sm text-gray-700">{text}</div>
        <div className="text-xs text-gray-400">{formatted}</div>
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
  const [programs, setPrograms] = useState<{ id: string; school_name: string; logo_url: string | null }[]>([])
  const supabase = createClient()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const fetchData = useCallback(async () => {
    const [{ data: stageData }, { data: entryData }] = await Promise.all([
      supabase.from('pipeline_stages').select('*').order('display_order'),
      supabase.from('pipeline_entries').select('id, program_id, stage_id, status, notes, created_at, programs(school_name, division, logo_url)'),
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
    const { data } = await supabase.from('programs').select('id, school_name, logo_url').order('school_name').limit(100)
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

      {detailEntry && <DetailView entry={detailEntry} stages={stages} onClose={() => setDetailEntry(null)} onSave={handleSaveNotes} />}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 mx-4 max-h-[70vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Add Program to Pipeline</h2>
            <div className="space-y-1">
              {programs.map(p => (
                <button key={p.id} onClick={() => handleAddProgram(p.id)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 rounded-lg transition flex items-center gap-3">
                  <TeamCircle school={p.school_name} logoUrl={p.logo_url} size={28} />
                  {p.school_name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
