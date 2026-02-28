"use client"

import { useState, useRef, useEffect } from "react"
import {
  Mail,
  Clock,
  ChevronRight,
  X,
  Bold,
  Italic,
  Underline,
  List,
  AlignLeft,
  Minus,
  Plus,
  Trash2,
  Check,
  Library,
  Save,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CustomTemplateCreator } from "./custom-template-creator"
import type { CampaignGoal, EmailTemplate } from "../types"

interface BuildStepProps {
  goal: CampaignGoal
  templates: EmailTemplate[]
  onTemplatesChange: (templates: EmailTemplate[]) => void
  onNext: () => void
  onBack: () => void
}

interface DatabaseTemplate {
  id: string
  name: string
  subject: string
  body: string
  is_system: boolean
  created_by?: string
  created_at: string
  updated_at: string
}

// Fallback templates (used if the database returns nothing for a goal)
// All use canonical ((Player ...)) / ((Coach ...)) / ((School Name)) tags.
const PLAYER_GOAL_TEMPLATES: Record<CampaignGoal, EmailTemplate[]> = {
  get_response: [
    {
      name: "Initial Introduction",
      subject: "((Player First Name)) ((Player Last Name)) | ((Player Position)) | Class of ((Player Grad Year))",
      body: "Dear Coach ((Coach Last Name)),\n\nMy name is ((Player First Name)) ((Player Last Name)). I'm a ((Player Position)) from ((Player High School)) in ((Player City)), ((Player State)), Class of ((Player Grad Year)).\n\nI'm very interested in your program at ((School Name)). Here is my film:\n((Player Film Link))\n\nGPA: ((Player GPA))\n\nThank you for your time!\n\n((Player First Name)) ((Player Last Name))\n((Player Phone))\n((Player Email))",
      delayDays: null
    },
    {
      name: "Follow-Up #1",
      subject: "Following Up — ((Player First Name)) ((Player Last Name)), ((Player Position))",
      body: "Coach ((Coach Last Name)),\n\nI wanted to follow up on my previous email about my interest in ((School Name)).\n\nFilm: ((Player Film Link))\n\nThank you for considering me!\n\n((Player First Name)) ((Player Last Name))\n((Player Phone))",
      delayDays: 7
    },
    {
      name: "Follow-Up #2",
      subject: "Quick Update — ((Player First Name)) ((Player Last Name))",
      body: "Hi Coach ((Coach Last Name)),\n\nI'm still very interested in ((School Name)) and wanted to share a quick update.\n\nFilm: ((Player Film Link))\nGPA: ((Player GPA)) | Class of ((Player Grad Year))\n\n((Player First Name)) ((Player Last Name))\n((Player Phone))",
      delayDays: 14
    },
    {
      name: "Final Follow-Up",
      subject: "One Last Note — ((Player First Name)) ((Player Last Name))",
      body: "Coach ((Coach Last Name)),\n\nThis will be my last email unless I hear back from you. I remain very interested in ((School Name)).\n\nFilm: ((Player Film Link))\n\nBest of luck with your season!\n\n((Player First Name)) ((Player Last Name))\n((Player Phone))\n((Player Email))",
      delayDays: 21
    }
  ],
  evaluate_film: [
    {
      name: "Film Share",
      subject: "((Player First Name)) ((Player Last Name)) — ((Player Position)) Film",
      body: "Coach ((Coach Last Name)),\n\nI wanted to share my latest film with you:\n((Player Film Link))\n\nGPA: ((Player GPA)) | Class of ((Player Grad Year)) | ((Player High School))\n\n((Player First Name)) ((Player Last Name))",
      delayDays: null
    }
  ],
  build_interest: [
    {
      name: "Build Interest",
      subject: "Why ((School Name)) Is My Top Choice",
      body: "Coach ((Coach Last Name)),\n\nI wanted to share more about myself beyond the field. ((School Name)) is my top choice because of your program's culture and academics.\n\nGPA: ((Player GPA)) | ((Player Position)) | Class of ((Player Grad Year))\n\nFilm: ((Player Film Link))\n\n((Player First Name)) ((Player Last Name))",
      delayDays: null
    }
  ],
  secure_visit: [
    {
      name: "Visit Request",
      subject: "Campus Visit — ((Player First Name)) ((Player Last Name))",
      body: "Coach ((Coach Last Name)),\n\nThank you for your interest in me as a recruit. I'd love to schedule a campus visit to meet you and the team at ((School Name)).\n\nFilm: ((Player Film Link))\n\nPlease let me know what dates work best.\n\n((Player First Name)) ((Player Last Name))\n((Player Phone))",
      delayDays: null
    }
  ],
  other: [
    {
      name: "Custom Message",
      subject: "",
      body: "Coach ((Coach Last Name)),\n\n\n\n((Player First Name)) ((Player Last Name))",
      delayDays: null
    }
  ]
}

const COACH_GOAL_TEMPLATES: Record<CampaignGoal, EmailTemplate[]> = {
  get_response: [
    {
      name: "Player Introduction",
      subject: "Prospect Introduction — ((Player First Name)) ((Player Last Name)), ((Player Position))",
      body: "Dear Coach ((Coach Last Name)),\n\nMy name is ((My First Name)), a coach at ((Player High School)). I'm reaching out to introduce you to one of my players, ((Player First Name)) ((Player Last Name)), a ((Player Position)) in the Class of ((Player Grad Year)).\n\nFilm: ((Player Film Link))\nGPA: ((Player GPA))\n\nI believe ((Player First Name)) would be a great fit for your program at ((School Name)). Please reach out if you'd like to learn more.\n\nThank you,\n((My First Name))",
      delayDays: null
    },
    {
      name: "Follow-Up Recommendation",
      subject: "Following Up — ((Player First Name)) ((Player Last Name))",
      body: "Coach ((Coach Last Name)),\n\nI wanted to follow up on my previous email about ((Player First Name)) ((Player Last Name)). ((Player First Name)) is very interested in ((School Name)) and I strongly believe in their potential.\n\nFilm: ((Player Film Link))\n\nThank you,\n((My First Name))",
      delayDays: 7
    }
  ],
  evaluate_film: [
    {
      name: "Film Recommendation",
      subject: "Film — ((Player First Name)) ((Player Last Name)), ((Player Position))",
      body: "Coach ((Coach Last Name)),\n\nI'd like to share film on ((Player First Name)) ((Player Last Name)), a ((Player Position)) from ((Player High School)) in the Class of ((Player Grad Year)).\n\n((Player Film Link))\n\nGPA: ((Player GPA))\n\nI think ((Player First Name)) has what it takes to compete at ((School Name)). Happy to discuss further.\n\n((My First Name))",
      delayDays: null
    }
  ],
  build_interest: [
    {
      name: "Camp Recommendation",
      subject: "Camp Invite for ((Player First Name)) ((Player Last Name))",
      body: "Coach ((Coach Last Name)),\n\nI'm reaching out on behalf of ((Player First Name)) ((Player Last Name)), a ((Player Position)) with a ((Player GPA)) GPA in the Class of ((Player Grad Year)).\n\nFilm: ((Player Film Link))\n\nI believe ((Player First Name)) would benefit greatly from attending your camp at ((School Name)).\n\nThank you,\n((My First Name))",
      delayDays: null
    }
  ],
  secure_visit: [
    {
      name: "Visit Request",
      subject: "Campus Visit for ((Player First Name)) ((Player Last Name))",
      body: "Coach ((Coach Last Name)),\n\n((Player First Name)) ((Player Last Name)) is very interested in ((School Name)) and would love to schedule a campus visit. ((Player First Name)) is a ((Player Position)) from ((Player High School)) with a ((Player GPA)) GPA.\n\nFilm: ((Player Film Link))\n\nPlease let us know what dates work best.\n\nThank you,\n((My First Name))",
      delayDays: null
    }
  ],
  other: [
    {
      name: "Custom Message",
      subject: "",
      body: "Coach ((Coach Last Name)),\n\n\n\n((My First Name))",
      delayDays: null
    }
  ]
}

// Merge tag buttons shown in the editor — audience-specific to avoid confusion
const PLAYER_MERGE_TAGS = [
  "Coach Last Name",
  "Coach First Name",
  "School Name",
  "Player First Name",
  "Player Last Name",
  "Player Position",
  "Player Grad Year",
  "Player High School",
  "Player City",
  "Player State",
  "Player GPA",
  "Player Film Link",
  "Player Phone",
  "Player Email",
]

const COACH_MERGE_TAGS = [
  "Coach Last Name",
  "Coach First Name",
  "School Name",
  "Player First Name",
  "Player Last Name",
  "Player Position",
  "Player Grad Year",
  "Player High School",
  "Player Film Link",
  "Player GPA",
  "My First Name",
  "My Last Name",
]

export function BuildStep({ goal, templates, onTemplatesChange, onNext, onBack }: BuildStepProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [showAddOverlay, setShowAddOverlay] = useState(false)
  const [availableTemplates, setAvailableTemplates] = useState<DatabaseTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [showCustomCreator, setShowCustomCreator] = useState(false)
  const [audience, setAudience] = useState<'player' | 'coach'>('player')

  // Load templates from database — also captures audience so we show the right defaults
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const response = await fetch('/api/templates')
        if (response.ok) {
          const { templates: dbTemplates, audience: dbAudience } = await response.json()
          setAvailableTemplates(dbTemplates || [])
          if (dbAudience === 'coach') setAudience('coach')
        } else {
          console.error('Failed to load templates')
        }
      } catch (error) {
        console.error('Error loading templates:', error)
      } finally {
        setLoadingTemplates(false)
      }
    }
    loadTemplates()
  }, [])

  // Initialize templates from audience-appropriate defaults if empty
  useEffect(() => {
    if (templates.length === 0) {
      const goalTemplates = audience === 'coach' ? COACH_GOAL_TEMPLATES : PLAYER_GOAL_TEMPLATES
      onTemplatesChange(goalTemplates[goal] || goalTemplates.get_response)
    }
  }, [goal, audience]) // eslint-disable-line react-hooks/exhaustive-deps

  const updateTemplate = (index: number, updates: Partial<EmailTemplate>) => {
    let updated = templates.map((t: EmailTemplate, i: number) => (i === index ? { ...t, ...updates } : t))
    // Auto-sort by delayDays (null/first email stays at 0)
    updated.sort((a, b) => (a.delayDays ?? -1) - (b.delayDays ?? -1))
    onTemplatesChange(updated)
    // Update editing index if it moved
    if (editingIndex !== null) {
      const editedTemplate = templates[index]
      const merged = { ...editedTemplate, ...updates }
      const newIndex = updated.findIndex(
        (t) => t.name === merged.name && t.subject === merged.subject
      )
      if (newIndex !== index) setEditingIndex(newIndex >= 0 ? newIndex : null)
    }
  }

  const deleteTemplate = (index: number) => {
    const updated = templates.filter((_, i) => i !== index)
    onTemplatesChange(updated)
    if (editingIndex === index) setEditingIndex(null)
    else if (editingIndex !== null && editingIndex > index) setEditingIndex(editingIndex - 1)
  }

  const addTemplates = (newTemplates: EmailTemplate[]) => {
    // Calculate delay: one day more than the last template
    const maxDelay = templates.reduce((max, t) => Math.max(max, t.delayDays ?? 0), 0)
    let nextDelay = maxDelay + 1

    const withDelays = newTemplates.map((t) => {
      const template = { ...t, delayDays: templates.length === 0 && nextDelay === 1 ? null : nextDelay }
      nextDelay++
      return template
    })

    let updated = [...templates, ...withDelays]
    updated.sort((a, b) => (a.delayDays ?? -1) - (b.delayDays ?? -1))
    onTemplatesChange(updated)
    setShowAddOverlay(false)
  }

  const handleCreateCustomTemplate = async (template: { name: string; subject: string; body: string }) => {
    try {
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template)
      })

      if (response.ok) {
        const { template: newTemplate } = await response.json()
        // Refresh the available templates list (remove any with same name for overwrite)
        setAvailableTemplates(prev => [newTemplate, ...prev.filter(t => t.name.toLowerCase() !== newTemplate.name.toLowerCase())])
        setShowCustomCreator(false)
        // Optionally, automatically add it to the sequence
        addTemplates([{
          name: newTemplate.name,
          subject: newTemplate.subject,
          body: newTemplate.body,
          delayDays: null
        }])
      } else {
        throw new Error('Failed to create template')
      }
    } catch (error) {
      console.error('Error creating template:', error)
      throw error
    }
  }

  const canProceed = templates.length > 0 && templates.every((t) => t.subject && t.body)

  return (
    <div className="px-5 pb-5">
      <h3 className="mb-2 font-display text-lg font-bold uppercase tracking-tight text-foreground">
        Build Your Email Sequence
      </h3>
      <p className="mb-6 text-sm text-muted-foreground">
        Create the emails that will be sent to coaches. Click to edit, drag to reorder.
      </p>

      {/* Template Cards */}
      <div className="mb-4 flex flex-col gap-3">
        {templates.map((template: EmailTemplate, index: number) => (
          <Card
            key={index}
            className="cursor-pointer border border-border bg-card p-4 transition-all hover:border-primary/20"
            onClick={() => setEditingIndex(index)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex shrink-0 items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {index + 1}
                </div>
                <Mail className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-medium text-foreground">{template.name}</h4>
                <p className="truncate text-xs text-muted-foreground">{template.subject}</p>
              </div>
              <div className="flex items-center gap-2">
                {template.delayDays !== null && (
                  <Badge variant="secondary" className="gap-1 text-[10px]">
                    <Clock className="h-3 w-3" />
                    Day {template.delayDays}
                  </Badge>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteTemplate(index)
                  }}
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Add Template Button */}
      <button
        type="button"
        onClick={() => setShowAddOverlay(true)}
        className="mb-6 w-full rounded-lg border border-dashed border-border bg-card py-3 text-sm text-muted-foreground transition-all hover:border-primary hover:bg-primary/[0.02] hover:text-foreground"
      >
        + Add Custom Email or a Template
      </button>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-border bg-secondary px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!canProceed}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continue <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      {/* Template Editor Overlay */}
      {editingIndex !== null && (
        <TemplateEditorOverlay
          key={editingIndex}
          template={templates[editingIndex]}
          index={editingIndex}
          mergeTags={audience === 'coach' ? COACH_MERGE_TAGS : PLAYER_MERGE_TAGS}
          onUpdate={(updates) => updateTemplate(editingIndex, updates)}
          onClose={() => setEditingIndex(null)}
          existingTemplateNames={availableTemplates.filter(t => !t.is_system).map(t => t.name)}
          onSaveAsTemplate={async (templateData) => {
            try {
              const response = await fetch('/api/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(templateData)
              })
              if (response.ok) {
                const { template: newTemplate } = await response.json()
                // Remove any existing template with the same name (overwrite case)
                setAvailableTemplates(prev => [newTemplate, ...prev.filter(t => t.name.toLowerCase() !== newTemplate.name.toLowerCase())])
              } else {
                throw new Error('Failed to save template')
              }
            } catch (error) {
              console.error('Error saving template:', error)
              throw error
            }
          }}
        />
      )}

      {/* Add Template Overlay */}
      {showAddOverlay && (
        <AddTemplateOverlay
          existingNames={templates.map((t) => t.name)}
          availableTemplates={availableTemplates}
          loadingTemplates={loadingTemplates}
          onAdd={addTemplates}
          onClose={() => setShowAddOverlay(false)}
          onDelete={async (id) => {
            const response = await fetch(`/api/templates/${id}`, { method: 'DELETE' })
            if (!response.ok) throw new Error('Failed to delete')
            setAvailableTemplates(prev => prev.filter(t => t.id !== id))
          }}
          onCreateNew={() => {
            setShowAddOverlay(false)
            setShowCustomCreator(true)
          }}
        />
      )}

      {/* Custom Template Creator */}
      {showCustomCreator && (
        <CustomTemplateCreator
          onSave={handleCreateCustomTemplate}
          onClose={() => setShowCustomCreator(false)}
        />
      )}
    </div>
  )
}

// ─── Add Template Overlay ───────────────────────────────────────
function AddTemplateOverlay({
  existingNames,
  availableTemplates,
  loadingTemplates,
  onAdd,
  onClose,
  onCreateNew,
  onDelete,
}: {
  existingNames: string[]
  availableTemplates: DatabaseTemplate[]
  loadingTemplates: boolean
  onAdd: (templates: EmailTemplate[]) => void
  onClose: () => void
  onCreateNew: () => void
  onDelete: (id: string) => Promise<void>
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const toggleTemplate = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleAdd = () => {
    const toAdd = Array.from(selected)
      .map(id => availableTemplates.find(t => t.id === id))
      .filter(Boolean)
      .map(t => ({
        name: t!.name,
        subject: t!.subject,
        body: t!.body,
        delayDays: null
      }))
    onAdd(toAdd)
  }

  const handleDelete = async (id: string) => {
    setDeleting(true)
    try {
      await onDelete(id)
      setSelected((prev) => { const next = new Set(prev); next.delete(id); return next })
    } catch {
      // Error logged by parent
    }
    setDeleting(false)
    setConfirmDeleteId(null)
  }

  // Separate system and user templates
  const systemTemplates = availableTemplates.filter(t => t.is_system)
  const userTemplates = availableTemplates.filter(t => !t.is_system)

  return (
    <div className="animate-in slide-in-from-right-8 fade-in fixed inset-0 z-[70] overflow-y-auto duration-200">
      <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-lg flex-col overflow-hidden bg-card shadow-2xl sm:rounded-l-2xl">
      <div className="flex items-center gap-4 border-b border-border px-5 py-4">
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <h3 className="flex-1 font-display text-lg font-bold uppercase tracking-tight text-foreground">
          Template Library
        </h3>
        <button
          type="button"
          onClick={handleAdd}
          disabled={selected.size === 0}
          className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Add ({selected.size})
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Create Custom Template Button */}
        <button
          type="button"
          onClick={onCreateNew}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg border border-primary bg-primary/[0.03] py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
        >
          <Library className="h-4 w-4" />
          Create Custom Email
        </button>

        {loadingTemplates ? (
          <p className="text-center text-sm text-muted-foreground">Loading templates...</p>
        ) : (
          <>
            {/* User Templates */}
            {userTemplates.length > 0 && (
              <>
                <h4 className="mb-2 text-xs font-semibold text-muted-foreground">Your Templates</h4>
                <div className="mb-4 flex flex-col gap-2">
                  {userTemplates.map((template) => {
                    const isSelected = selected.has(template.id)
                    const alreadyInSequence = existingNames.includes(template.name)
                    const isConfirmingDelete = confirmDeleteId === template.id
                    return (
                      <div key={template.id} className="relative">
                        <button
                          type="button"
                          onClick={() => !alreadyInSequence && toggleTemplate(template.id)}
                          disabled={alreadyInSequence}
                          className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                            alreadyInSequence
                              ? "border-border bg-secondary/30 opacity-50 cursor-not-allowed"
                              : isSelected
                                ? "border-primary/30 bg-primary/[0.03]"
                                : "border-border bg-card hover:border-primary/20"
                          }`}
                        >
                          <div
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                              isSelected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border"
                            }`}
                          >
                            {isSelected && <Check className="h-3 w-3" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h5 className="font-medium text-foreground">{template.name}</h5>
                            <p className="truncate text-xs text-muted-foreground">{template.subject}</p>
                          </div>
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(template.id) }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setConfirmDeleteId(template.id) } }}
                            className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </div>
                        </button>
                        {/* Delete confirmation */}
                        {isConfirmingDelete && (
                          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-card/95 backdrop-blur-sm border border-border">
                            <div className="text-center px-4">
                              <p className="text-sm font-medium text-foreground mb-3">Delete &ldquo;{template.name}&rdquo;?</p>
                              <div className="flex justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(template.id)}
                                  disabled={deleting}
                                  className="rounded-md bg-[hsl(0,72%,51%)] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[hsl(0,72%,45%)] disabled:opacity-40"
                                >
                                  {deleting ? 'Deleting...' : 'Delete'}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* System Templates */}
            <h4 className="mb-2 text-xs font-semibold text-muted-foreground">Recommended Templates</h4>
            <div className="flex flex-col gap-2">
              {systemTemplates.map((template) => {
                const isSelected = selected.has(template.id)
                const alreadyInSequence = existingNames.includes(template.name)
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => !alreadyInSequence && toggleTemplate(template.id)}
                    disabled={alreadyInSequence}
                    className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                      alreadyInSequence
                        ? "border-border bg-secondary/30 opacity-50 cursor-not-allowed"
                        : isSelected
                          ? "border-primary/30 bg-primary/[0.03]"
                          : "border-border bg-card hover:border-primary/20"
                    }`}
                  >
                    <div
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border"
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h5 className="font-medium text-foreground">{template.name}</h5>
                      <p className="truncate text-xs text-muted-foreground">{template.subject}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
    </div>
  )
}

// ─── Template Editor Overlay ────────────────────────────────────
function TemplateEditorOverlay({
  template,
  index,
  mergeTags,
  onUpdate,
  onClose,
  onSaveAsTemplate,
  existingTemplateNames,
}: {
  template: EmailTemplate
  index: number
  mergeTags: string[]
  onUpdate: (updates: Partial<EmailTemplate>) => void
  onClose: () => void
  onSaveAsTemplate: (data: { name: string; subject: string; body: string }) => Promise<void>
  existingTemplateNames: string[]
}) {
  const [name, setName] = useState(template.name)
  const [subject, setSubject] = useState(template.subject)
  const [body, setBody] = useState(template.body || '')
  const [delayDays, setDelayDays] = useState(template.delayDays ?? 0)
  const [showSaveAs, setShowSaveAs] = useState(false)
  const [saveAsName, setSaveAsName] = useState('')
  const [savingAs, setSavingAs] = useState(false)
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const handleSave = () => {
    onUpdate({ name, subject, body, delayDays: index === 0 ? null : delayDays })
    onClose()
  }

  const handleSaveAs = async () => {
    if (!saveAsName.trim()) return
    const trimmedName = saveAsName.trim()

    // Check for duplicate name (case-insensitive)
    if (!showOverwriteConfirm && existingTemplateNames.some(n => n.toLowerCase() === trimmedName.toLowerCase())) {
      setShowOverwriteConfirm(true)
      setSavingAs(false)
      return
    }

    setSavingAs(true)
    setShowOverwriteConfirm(false)
    try {
      await onSaveAsTemplate({ name: trimmedName, subject, body })
    } catch {
      // Error already logged by parent — still close and apply changes
    }
    // Apply changes to the current campaign using the new template name
    onUpdate({ name: trimmedName, subject, body, delayDays: index === 0 ? null : delayDays })
    onClose()
  }

  const insertMergeTag = (tag: string) => {
    if (!bodyRef.current) return
    const start = bodyRef.current.selectionStart
    const end = bodyRef.current.selectionEnd
    const currentBody = body || ''
    const newBody = currentBody.slice(0, start) + `((${tag}))` + currentBody.slice(end)
    setBody(newBody)
    // Reset cursor position after React re-render
    setTimeout(() => {
      if (bodyRef.current) {
        bodyRef.current.selectionStart = start + tag.length + 4
        bodyRef.current.selectionEnd = start + tag.length + 4
        bodyRef.current.focus()
      }
    }, 0)
  }

  const applyFormat = (format: "bold" | "italic" | "underline" | "list") => {
    if (!bodyRef.current) return
    const start = bodyRef.current.selectionStart
    const end = bodyRef.current.selectionEnd
    const currentBody = body || ''
    const selectedText = currentBody.slice(start, end)

    let newText = selectedText
    switch (format) {
      case "bold":
        newText = `**${selectedText}**`
        break
      case "italic":
        newText = `*${selectedText}*`
        break
      case "underline":
        newText = `__${selectedText}__`
        break
      case "list":
        newText = selectedText
          .split("\n")
          .map((line) => (line.trim() ? `• ${line}` : line))
          .join("\n")
        break
    }

    const newBody = currentBody.slice(0, start) + newText + currentBody.slice(end)
    setBody(newBody)
  }

  return (
    <div className="animate-in slide-in-from-right-8 fade-in fixed inset-0 z-[70] overflow-y-auto duration-200">
      <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col overflow-hidden bg-card shadow-2xl sm:rounded-l-2xl">
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
          <h3 className="flex-1 font-display text-lg font-bold uppercase tracking-tight text-foreground">
            Edit Email Template
          </h3>
          <button
            type="button"
            onClick={() => { setSaveAsName(name); setShowSaveAs(true) }}
            className="rounded-md bg-[hsl(0,72%,51%)] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[hsl(0,72%,45%)]"
          >
            Save As
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Save Changes
          </button>
        </div>

        {/* Save As Popup */}
        {showSaveAs && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" onClick={() => { setShowSaveAs(false); setShowOverwriteConfirm(false) }} />
            <div className="relative mx-4 w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-2xl">
              {showOverwriteConfirm ? (
                <>
                  <h4 className="mb-1 font-display text-base font-bold uppercase tracking-tight text-foreground">
                    Template Already Exists
                  </h4>
                  <p className="mb-4 text-sm text-muted-foreground">
                    A template named &ldquo;{saveAsName.trim()}&rdquo; already exists. Do you want to replace it?
                  </p>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => { setShowOverwriteConfirm(false) }}
                      className="rounded-md border border-border bg-secondary px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                    >
                      Go Back
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveAs}
                      disabled={savingAs}
                      className="rounded-md bg-[hsl(0,72%,51%)] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[hsl(0,72%,45%)] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {savingAs ? 'Saving...' : 'Replace Template'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h4 className="mb-1 font-display text-base font-bold uppercase tracking-tight text-foreground">
                    Save as Template
                  </h4>
                  <p className="mb-4 text-xs text-muted-foreground">
                    Save this email to your template library for reuse.
                  </p>
                  <input
                    type="text"
                    value={saveAsName}
                    onChange={(e) => { setSaveAsName(e.target.value); setShowOverwriteConfirm(false) }}
                    placeholder="Template name"
                    className="mb-4 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveAs()}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowSaveAs(false)}
                      className="rounded-md border border-border bg-secondary px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveAs}
                      disabled={!saveAsName.trim() || savingAs}
                      className="rounded-md bg-[hsl(0,72%,51%)] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[hsl(0,72%,45%)] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {savingAs ? 'Saving...' : 'Save Template'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-6">
          {/* Template Name */}
          <div className="mb-6">
            <label htmlFor="template-name" className="mb-2 block text-xs font-medium text-foreground">
              Template Name
            </label>
            <input
              id="template-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Delay Days */}
          {index > 0 && (
            <div className="mb-6">
              <label className="mb-2 block text-xs font-medium text-foreground">
                Send After (Days)
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDelayDays(Math.max(1, delayDays - 1))}
                  className="rounded border border-border bg-secondary px-2 py-1 transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <input
                  type="number"
                  value={delayDays}
                  onChange={(e) => setDelayDays(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 rounded-md border border-border bg-card px-2 py-1 text-center text-sm text-foreground"
                />
                <button
                  type="button"
                  onClick={() => setDelayDays(delayDays + 1)}
                  className="rounded border border-border bg-secondary px-2 py-1 transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  <Plus className="h-3 w-3" />
                </button>
                <span className="text-xs text-muted-foreground">days after previous email</span>
              </div>
            </div>
          )}

          {/* Subject Line */}
          <div className="mb-6">
            <label htmlFor="subject" className="mb-2 block text-xs font-medium text-foreground">
              Subject Line
            </label>
            <input
              id="subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., ((First Name)), I'm interested in your program"
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Email Body */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor="body" className="block text-xs font-medium text-foreground">
                Email Body
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => applyFormat("bold")}
                  className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  title="Bold"
                >
                  <Bold className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormat("italic")}
                  className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  title="Italic"
                >
                  <Italic className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormat("underline")}
                  className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  title="Underline"
                >
                  <Underline className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormat("list")}
                  className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  title="Bullet List"
                >
                  <List className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Merge Tags */}
            <div className="mb-3 flex flex-wrap gap-1">
              {mergeTags.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => insertMergeTag(label)}
                  className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  {label}
                </button>
              ))}
            </div>

            <textarea
              ref={bodyRef}
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Write your email here..."
            />
          </div>
        </div>
      </div>
    </div>
  )
}