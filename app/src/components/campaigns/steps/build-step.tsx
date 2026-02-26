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

// Default templates for each goal (fallback if database is empty)
const GOAL_TEMPLATES: Record<CampaignGoal, EmailTemplate[]> = {
  get_response: [
    {
      name: "Introduction Email",
      subject: "((First Name)), I'm Interested in Your Program",
      body: "Dear Coach ((Last Name)),\n\nMy name is ((First Name)) ((Last Name)), and I'm a ((Position)) from ((High School)) in ((City)), ((State)). I'm reaching out because I'm very interested in your program at ((School)).\n\n((Stats))\n\nI'd love to learn more about your program and what you look for in recruits. My highlight film is available at: ((Film Link))\n\nThank you for your time!\n\n((First Name)) ((Last Name))\n((Phone))\n((Email))",
      delayDays: null
    },
    {
      name: "Follow-Up #1",
      subject: "Following Up - ((First Name)) ((Last Name)), ((Position))",
      body: "Coach ((Last Name)),\n\nI wanted to follow up on my previous email about my interest in ((School)). I know you're busy, but I'd really appreciate any feedback you might have.\n\nI've been working hard on ((Improvement Area)) and recently ((Recent Achievement)).\n\nMy updated stats:\n((Stats))\n\nFilm: ((Film Link))\n\nThank you for considering me!\n\n((First Name)) ((Last Name))",
      delayDays: 7
    },
    {
      name: "Follow-Up #2",
      subject: "Quick Update from ((First Name)) ((Last Name))",
      body: "Hi Coach ((Last Name)),\n\nI hope this finds you well. I wanted to share a quick update from my recent ((Recent Game/Event)).\n\n((Recent Performance))\n\nI'm still very interested in ((School)) and would love to know:\n- What you look for in a ((Position))\n- Your recruiting timeline\n- If there's anything specific you'd like to see from me\n\nThanks again for your time.\n\n((First Name)) ((Last Name))\n((Phone))",
      delayDays: 14
    },
    {
      name: "Final Follow-Up",
      subject: "One More Try - ((First Name)) ((Last Name))",
      body: "Coach ((Last Name)),\n\nI understand you're extremely busy, and I don't want to be a bother. This will be my last email unless I hear back from you.\n\nI remain very interested in ((School)) because ((Specific Reason)). If there's any possibility of discussing your program, I'd be grateful for the opportunity.\n\nIf the timing isn't right or you're not interested, I completely understand. Either way, I appreciate you taking the time to read my emails.\n\nBest of luck with your season!\n\n((First Name)) ((Last Name))\n((All Contact Info))",
      delayDays: 21
    }
  ],
  evaluate_film: [
    {
      name: "Film Share",
      subject: "((First Name)) ((Last Name)) - ((Position)) Film",
      body: "Coach ((Last Name)),\n\nI wanted to share my latest film with you. I've had a strong season and would appreciate your evaluation.\n\n((Film Link))\n\nKey highlights:\n((Stats))\n\nI look forward to hearing your thoughts.\n\n((First Name)) ((Last Name))",
      delayDays: null
    }
  ],
  build_interest: [
    {
      name: "Personal Story",
      subject: "Why ((School)) Is My Top Choice",
      body: "Coach ((Last Name)),\n\nI wanted to share more about myself beyond the field. ((Personal Story))\n\nAcademically, I maintain a ((GPA)) GPA and am interested in studying ((Major)).\n\nI believe I'd be a great fit for your program both athletically and academically.\n\n((First Name)) ((Last Name))",
      delayDays: null
    }
  ],
  secure_visit: [
    {
      name: "Visit Request",
      subject: "Campus Visit Opportunity",
      body: "Coach ((Last Name)),\n\nThank you for your interest in me as a recruit. I'm very excited about the possibility of joining your program.\n\nI'd love to schedule a campus visit to meet you and the team. I'm available ((Availability)).\n\nPlease let me know what dates work best for you.\n\n((First Name)) ((Last Name))",
      delayDays: null
    }
  ],
  other: [
    {
      name: "Custom Message",
      subject: "",
      body: "Coach ((Last Name)),\n\n\n\n((First Name)) ((Last Name))",
      delayDays: null
    }
  ]
}

const MERGE_TAGS = [
  { key: "first_name", label: "First Name" },
  { key: "last_name", label: "Last Name" },
  { key: "position", label: "Position" },
  { key: "high_school", label: "High School" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "school", label: "School" },
  { key: "coach_name", label: "Coach Name" },
  { key: "stats", label: "Stats" },
  { key: "film_link", label: "Film Link" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "gpa", label: "GPA" },
  { key: "major", label: "Major" },
  { key: "personal_story", label: "Personal Story" },
  { key: "availability", label: "Availability" }
]

export function BuildStep({ goal, templates, onTemplatesChange, onNext, onBack }: BuildStepProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [showAddOverlay, setShowAddOverlay] = useState(false)
  const [availableTemplates, setAvailableTemplates] = useState<DatabaseTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [showCustomCreator, setShowCustomCreator] = useState(false)

  // Load templates from database
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const response = await fetch('/api/templates')
        if (response.ok) {
          const { templates: dbTemplates } = await response.json()
          setAvailableTemplates(dbTemplates || [])
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

  // Initialize templates from defaults if empty
  useEffect(() => {
    if (templates.length === 0) {
      onTemplatesChange(GOAL_TEMPLATES[goal] || GOAL_TEMPLATES.get_response)
    }
  }, [goal]) // eslint-disable-line react-hooks/exhaustive-deps

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
        // Refresh the available templates list
        setAvailableTemplates(prev => [newTemplate, ...prev])
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
          onUpdate={(updates) => updateTemplate(editingIndex, updates)}
          onClose={() => setEditingIndex(null)}
          onSaveAsTemplate={async (templateData) => {
            try {
              const response = await fetch('/api/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(templateData)
              })
              if (response.ok) {
                const { template: newTemplate } = await response.json()
                setAvailableTemplates(prev => [newTemplate, ...prev])
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
}: {
  existingNames: string[]
  availableTemplates: DatabaseTemplate[]
  loadingTemplates: boolean
  onAdd: (templates: EmailTemplate[]) => void
  onClose: () => void
  onCreateNew: () => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

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
  onUpdate,
  onClose,
  onSaveAsTemplate,
}: {
  template: EmailTemplate
  index: number
  onUpdate: (updates: Partial<EmailTemplate>) => void
  onClose: () => void
  onSaveAsTemplate: (data: { name: string; subject: string; body: string }) => Promise<void>
}) {
  const [name, setName] = useState(template.name)
  const [subject, setSubject] = useState(template.subject)
  const [body, setBody] = useState(template.body || '')
  const [delayDays, setDelayDays] = useState(template.delayDays ?? 0)
  const [showSaveAs, setShowSaveAs] = useState(false)
  const [saveAsName, setSaveAsName] = useState('')
  const [savingAs, setSavingAs] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const handleSave = () => {
    onUpdate({ name, subject, body, delayDays: index === 0 ? null : delayDays })
    onClose()
  }

  const handleSaveAs = async () => {
    if (!saveAsName.trim()) return
    setSavingAs(true)
    try {
      await onSaveAsTemplate({ name: saveAsName.trim(), subject, body })
      // Also apply changes to the current campaign
      onUpdate({ name, subject, body, delayDays: index === 0 ? null : delayDays })
      onClose()
    } catch {
      // Error already logged by parent
    } finally {
      setSavingAs(false)
    }
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
            <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" onClick={() => setShowSaveAs(false)} />
            <div className="relative mx-4 w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-2xl">
              <h4 className="mb-1 font-display text-base font-bold uppercase tracking-tight text-foreground">
                Save as Template
              </h4>
              <p className="mb-4 text-xs text-muted-foreground">
                Save this email to your template library for reuse.
              </p>
              <input
                type="text"
                value={saveAsName}
                onChange={(e) => setSaveAsName(e.target.value)}
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
              {MERGE_TAGS.map((tag) => (
                <button
                  key={tag.key}
                  type="button"
                  onClick={() => insertMergeTag(tag.label)}
                  className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  {tag.label}
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