"use client"

import { useState, useRef, useEffect } from "react"
import {
  Mail,
  ChevronRight,
  X,
  Bold,
  Italic,
  Underline,
  PenLine,
  CircleCheck,
  Circle,
  Trash2,
  Eye,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import type { EmailTemplate, SelectedCoach } from "../types"

interface BuildStepProps {
  templates: EmailTemplate[]
  recruitingEmail?: string | null
  selectedCoaches?: SelectedCoach[]
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

// Recommended campaign templates — based on proven scripts that have
// generated $30M+ in scholarships across 14 sports and 1M+ emails sent.
// These are the 3 best-performing first-contact scripts.
const PLAYER_TEMPLATES: EmailTemplate[] = [
  {
    name: "Direct Introduction",
    subject: "((Player First Name)) ((Player Last Name)) ((Player Grad Year)) ((Player Position))",
    body: "Hi Coach ((Coach Last Name)),\n\nMy name is ((Player First Name)) ((Player Last Name)). I'm a ((Player Grad Year)) ((Player Position)) from ((Player City)), ((Player State)).\n\nDo you need a ((Player Grad Year)) ((Player Position))?\n\nHere is my video:\n((Player Film Link))\n\nThanks,\n((Player First Name)) ((Player Last Name))\n((Player Phone))",
    delayDays: null
  },
  {
    name: "Film & Coach Reference",
    subject: "((Player First Name)) ((Player Last Name)) ((Player Grad Year)) ((Player Position))",
    body: "Hi Coach ((Coach Last Name)),\n\nAre you currently looking for a ((Player Grad Year)) ((Player Position))?\n\nFor reference, please feel free to call my coach, ((Coach Name)) - ((Coach Phone))\n\nHere is my video:\n((Player Film Link))\n\nThanks,\n((Player First Name)) ((Player Last Name))\n((Player Phone))",
    delayDays: null
  },
  {
    name: "Genuine Interest",
    subject: "((Player First Name)) ((Player Last Name)) ((Player Grad Year)) ((Player Position))",
    body: "Hi Coach ((Coach Last Name)),\n\nI'm genuinely interested in ((School Name with The)).\n\nDo you need a ((Player Grad Year)) ((Player Position))?\n\nHere is my video:\n((Player Film Link))\n\nThanks,\n((Player First Name)) ((Player Last Name))\n((Player Phone))",
    delayDays: null
  },
]

const COACH_TEMPLATES: EmailTemplate[] = [
  {
    name: "Coach Introduction",
    subject: "((Player First Name)) ((Player Last Name)) ((Player Grad Year)) ((Player Position))",
    body: "Hi Coach ((Coach Last Name)),\n\nMy name is ((My First Name)) ((My Last Name)). I am the ((My Title)) at ((Player High School)) in ((Player City)), ((Player State)).\n\nI'm writing to let you know I have a ((Player Grad Year)) ((Player Position)) named ((Player First Name)) ((Player Last Name)) that you should take a close look at. In addition to being one of the best ((Player Position))s I've ever coached, he's also a leader on the field, in the classroom, and in the community.\n\nHere is his video:\n((Player Film Link))\n\nI would love to host you or anyone from your staff here at the school at your earliest convenience.\n\nThanks,\n((My First Name)) ((My Last Name))",
    delayDays: null
  },
]

// Merge tag buttons shown in the editor — audience-specific to avoid confusion
const PLAYER_MERGE_TAGS = [
  "Coach Last Name",
  "Coach First Name",
  "School Name",
  "School Name with The",
  "Player First Name",
  "Player Last Name",
  "Player Position",
  "Player Grad Year",
  "Player High School",
  "Player City",
  "Player State",
  "Player GPA",
  "Player Height",
  "Player Weight",
  "Player Film Link",
  "Player Phone",
  "Player Email",
  "Coach Name",
  "Coach Phone",
  "Coach Email Address",
]

const COACH_MERGE_TAGS = [
  "Coach Last Name",
  "Coach First Name",
  "School Name",
  "School Name with The",
  "Player First Name",
  "Player Last Name",
  "Player Position",
  "Player Grad Year",
  "Player High School",
  "Player Film Link",
  "Player GPA",
  "Player Height",
  "Player Weight",
  "My First Name",
  "My Last Name",
  "My Title",
  "Coach Name",
  "Coach Phone",
  "Coach Email Address",
]

export function BuildStep({ templates, recruitingEmail, selectedCoaches, onTemplatesChange, onNext, onBack }: BuildStepProps) {
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [availableTemplates, setAvailableTemplates] = useState<DatabaseTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [audience, setAudience] = useState<'player' | 'coach'>('player')
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null)
  const [previewData, setPreviewData] = useState<Record<string, string> | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  // Recommended templates — same for all campaigns (no goal selection)
  const defaultTemplates: EmailTemplate[] = audience === 'coach' ? COACH_TEMPLATES : PLAYER_TEMPLATES

  // User-saved templates from DB
  const userTemplates: EmailTemplate[] = availableTemplates
    .filter(t => !t.is_system)
    .map(t => ({
      name: t.name,
      subject: t.subject,
      body: t.body,
      delayDays: null,
    }))

  // The "Write Custom Email" option
  const customTemplate: EmailTemplate = {
    name: "Write Custom Email",
    subject: "",
    body: "",
    delayDays: null,
  }

  // User-saved templates override any default with the same name — each user
  // owns their own version. The first time they Save Changes on a default,
  // a user-scoped copy replaces that default in the list from then on.
  const userTemplateNamesLower = new Set(userTemplates.map(t => t.name.toLowerCase()))
  const visibleDefaults = defaultTemplates.filter(t => !userTemplateNamesLower.has(t.name.toLowerCase()))

  // Full display list: defaults (minus those the user has overridden) + user saved + custom
  // Coaches get only the one recommended template + custom (no saved templates)
  const displayTemplates = audience === 'coach'
    ? [...defaultTemplates, customTemplate]
    : [...visibleDefaults, ...userTemplates, customTemplate]

  // Load templates from database — also captures audience so we show the right defaults
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const response = await fetch('/api/templates')
        if (response.ok) {
          const { templates: dbTemplates, audience: dbAudience } = await response.json()
          setAvailableTemplates(dbTemplates || [])
          if (dbAudience === 'coach') setAudience('coach')
        }
      } catch (error) {
        console.error('Error loading templates:', error)
      } finally {
        setLoadingTemplates(false)
      }
    }
    loadTemplates()
  }, [])

  // Keep selectedIndex in sync with the campaign's selected template name
  // whenever the list composition changes — e.g., after Save Changes promotes
  // a default template into the user section (different position), or on
  // initial load when returning from a later step.
  useEffect(() => {
    if (templates.length === 0) return
    const existingName = templates[0].name
    const idx = displayTemplates.findIndex(t => t.name.toLowerCase() === existingName.toLowerCase())
    if (idx >= 0 && idx !== selectedIndex) {
      setSelectedIndex(idx)
    }
  }, [templates, availableTemplates, audience]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = (index: number) => {
    setSelectedIndex(index)
    const template = displayTemplates[index]
    onTemplatesChange([{ ...template, delayDays: null }])
  }

  const handleRowClick = (index: number) => {
    // Open overlay + auto-select
    handleSelect(index)
    setEditingTemplate({ ...displayTemplates[index] })
  }

  const handleCheckClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation()
    handleSelect(index)
  }

  const handleEditorSave = (updates: Partial<EmailTemplate>) => {
    if (selectedIndex === null) return
    const updated = { ...displayTemplates[selectedIndex], ...updates, delayDays: null }
    onTemplatesChange([updated])
    setEditingTemplate(null)
  }

  // Persist the user's edits to the DB under the current template name.
  // - Existing user template (matched by name) → PATCH that row
  // - Name not yet in user templates (i.e. first edit of a default) → POST
  //   a new user template, which then overrides the default in the display.
  const handlePersistTemplate = async (data: { name: string; subject: string; body: string }) => {
    const match = availableTemplates.find(
      t => !t.is_system && t.name.toLowerCase() === data.name.toLowerCase()
    )
    try {
      if (match) {
        const res = await fetch(`/api/templates/${match.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        if (!res.ok) throw new Error('Failed to update template')
        const { template: updated } = await res.json()
        setAvailableTemplates(prev => prev.map(t => t.id === updated.id ? updated : t))
      } else {
        const res = await fetch('/api/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        if (!res.ok) throw new Error('Failed to save template')
        const { template: created } = await res.json()
        setAvailableTemplates(prev => [created, ...prev])
      }
    } catch (error) {
      console.error('Error saving template changes:', error)
      throw error
    }
  }

  const isCustom = (index: number) => index === displayTemplates.length - 1

  const handlePreview = async (e: React.MouseEvent, index: number) => {
    e.stopPropagation()
    const template = displayTemplates[index]
    setPreviewTemplate(template)
    setLoadingPreview(true)
    try {
      const res = await fetch('/api/templates/preview-data')
      if (res.ok) {
        const { mergeData } = await res.json()
        setPreviewData(mergeData)
      }
    } catch (err) {
      console.error('Failed to load preview data:', err)
    } finally {
      setLoadingPreview(false)
    }
  }

  // Can proceed if a template is selected AND it has subject + body
  // (custom email must be filled in)
  const canProceed = selectedIndex !== null &&
    templates.length > 0 &&
    templates[0].subject?.trim() &&
    templates[0].body?.trim()

  return (
    <div className="px-5 pb-5">
      {/* Campaign Goal Banner */}
      <div className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Campaign Goal</p>
        <p className="mt-2 font-display text-lg font-bold uppercase tracking-tight text-foreground">
          Get coaches to <span className="text-primary">watch your film</span> and <span className="text-primary">respond</span>
        </p>
      </div>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h3 className="mb-2 font-display text-lg font-bold uppercase tracking-tight text-foreground">
            Choose Your Template
          </h3>
          <p className="text-sm text-muted-foreground">
            Browse recommended templates and customize for a personal touch.
          </p>
        </div>
        {recruitingEmail && (
          <div className="hidden sm:flex shrink-0 items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap">Recruiting Email</span>
            <span className="text-sm font-semibold text-foreground">{recruitingEmail}</span>
          </div>
        )}
      </div>

      {/* Template Selection List */}
      <div className="mb-6 flex flex-col gap-2">
        {loadingTemplates ? (
          <p className="text-center text-sm text-muted-foreground py-8">Loading templates...</p>
        ) : (
          displayTemplates.map((template, index) => {
            const isSelected = selectedIndex === index
            const isCustomRow = isCustom(index)

            return (
              <Card
                key={`${template.name}-${index}`}
                className={`cursor-pointer border p-4 transition-all hover:border-primary/20 ${
                  isSelected
                    ? "border-green-500/40 bg-green-50/30 dark:bg-green-950/10"
                    : "border-border bg-card"
                }`}
                onClick={() => handleRowClick(index)}
              >
                <div className="flex items-center gap-3">
                  {/* Green checkmark / empty circle */}
                  <button
                    type="button"
                    onClick={(e) => handleCheckClick(e, index)}
                    className="shrink-0 transition-colors"
                    aria-label={isSelected ? "Selected" : "Select template"}
                  >
                    {isSelected ? (
                      <CircleCheck className="h-6 w-6 text-green-600" />
                    ) : (
                      <Circle className="h-6 w-6 text-muted-foreground/40" />
                    )}
                  </button>

                  {/* Template icon */}
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {isCustomRow ? <PenLine className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                  </div>

                  {/* Template info */}
                  <div className="min-w-0 flex-1">
                    <h4 className={`text-sm ${isSelected ? "font-bold text-foreground" : "font-medium text-foreground"}`}>
                      {template.name}
                    </h4>
                    {!isCustomRow && template.subject && (
                      <p className="truncate text-xs text-muted-foreground">{template.subject}</p>
                    )}
                    {isCustomRow && (
                      <p className="text-xs text-muted-foreground">Start from scratch with a blank email</p>
                    )}
                  </div>

                  {/* Preview button (not on custom email) */}
                  {!isCustomRow && (
                    <button
                      type="button"
                      onClick={(e) => handlePreview(e, index)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                      title="Preview with your data"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  )}

                  {/* Chevron to indicate clickable */}
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                </div>
              </Card>
            )
          })
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-border bg-secondary px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-border hover:text-foreground"
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

      {/* Template Preview Overlay */}
      {previewTemplate && (
        <TemplatePreviewOverlay
          template={previewTemplate}
          mergeData={previewData}
          loading={loadingPreview}
          firstCoach={selectedCoaches?.[0] || null}
          onClose={() => { setPreviewTemplate(null); setPreviewData(null) }}
        />
      )}

      {/* Template Editor Overlay */}
      {editingTemplate && selectedIndex !== null && (
        <TemplateEditorOverlay
          key={selectedIndex}
          template={editingTemplate}
          mergeTags={audience === 'coach' ? COACH_MERGE_TAGS : PLAYER_MERGE_TAGS}
          onUpdate={(updates) => handleEditorSave(updates)}
          onSaveChanges={handlePersistTemplate}
          onClose={() => setEditingTemplate(null)}
          existingTemplateNames={availableTemplates.filter(t => !t.is_system).map(t => t.name)}
          userTemplateId={(() => {
            // Match by name against user-saved templates — the display list
            // changes composition (defaults can be overridden by user copies),
            // so index math is unreliable. The Custom Email row has a blank
            // name and won't match anything.
            const current = displayTemplates[selectedIndex]
            if (!current?.name) return null
            const match = availableTemplates.find(
              t => !t.is_system && t.name.toLowerCase() === current.name.toLowerCase()
            )
            return match?.id || null
          })()}
          onDeleteTemplate={async (templateId) => {
            try {
              const response = await fetch(`/api/templates/${templateId}`, { method: 'DELETE' })
              if (response.ok) {
                setAvailableTemplates(prev => prev.filter(t => t.id !== templateId))
                setSelectedIndex(null)
                onTemplatesChange([])
                setEditingTemplate(null)
              } else {
                throw new Error('Failed to delete template')
              }
            } catch (error) {
              console.error('Error deleting template:', error)
              throw error
            }
          }}
          onSaveAsTemplate={async (templateData) => {
            try {
              const response = await fetch('/api/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(templateData)
              })
              if (response.ok) {
                const { template: newTemplate } = await response.json()
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
    </div>
  )
}

// ─── Template Editor Overlay ────────────────────────────────────
function TemplateEditorOverlay({
  template,
  mergeTags,
  onUpdate,
  onSaveChanges,
  onClose,
  onSaveAsTemplate,
  existingTemplateNames,
  userTemplateId,
  onDeleteTemplate,
}: {
  template: EmailTemplate
  mergeTags: string[]
  onUpdate: (updates: Partial<EmailTemplate>) => void
  onSaveChanges: (data: { name: string; subject: string; body: string }) => Promise<void>
  onClose: () => void
  onSaveAsTemplate: (data: { name: string; subject: string; body: string }) => Promise<void>
  existingTemplateNames: string[]
  userTemplateId: string | null
  onDeleteTemplate: (templateId: string) => Promise<void>
}) {
  const [name, setName] = useState(template.name)
  const [subject, setSubject] = useState(template.subject)
  const [body, setBody] = useState(template.body || '')
  const [showSaveAs, setShowSaveAs] = useState(false)
  const [saveAsName, setSaveAsName] = useState('')
  const [savingAs, setSavingAs] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  // The Custom Email row is never saved to the user's template library — it's
  // a one-off for this campaign. Save Changes hides/becomes a no-DB apply.
  const isCustomEmail = template.name === 'Write Custom Email'

  const handleSave = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setSaveError('Template name is required')
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      if (!isCustomEmail) {
        await onSaveChanges({ name: trimmedName, subject, body })
      }
      onUpdate({ name: trimmedName, subject, body, delayDays: null })
      onClose()
    } catch {
      setSaveError('Failed to save. Try again.')
    } finally {
      setSaving(false)
    }
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
    onUpdate({ name: trimmedName, subject, body, delayDays: null })
    onClose()
  }

  const insertMergeTag = (tag: string) => {
    if (!bodyRef.current) return
    const start = bodyRef.current.selectionStart
    const end = bodyRef.current.selectionEnd
    const currentBody = body || ''
    const newBody = currentBody.slice(0, start) + `((${tag}))` + currentBody.slice(end)
    setBody(newBody)
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
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-foreground transition-colors hover:bg-border hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
          <h3 className="flex-1 font-display text-lg font-bold uppercase tracking-tight text-foreground">
            Edit Email
          </h3>
          {userTemplateId && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
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
            disabled={saving}
            className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
        {saveError && (
          <div className="border-b border-red-200 bg-red-50 px-5 py-2 text-xs font-medium text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
            {saveError}
          </div>
        )}

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
                      className="rounded-md border border-border bg-secondary px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-border hover:text-foreground"
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
                      className="rounded-md border border-border bg-secondary px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-border hover:text-foreground"
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

        {/* Delete Confirmation */}
        {showDeleteConfirm && userTemplateId && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)} />
            <div className="relative mx-4 w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-2xl">
              <h4 className="mb-1 font-display text-base font-bold uppercase tracking-tight text-foreground">
                Delete Template
              </h4>
              <p className="mb-4 text-sm text-muted-foreground">
                Are you sure you want to delete &ldquo;{name}&rdquo;? This cannot be undone.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="rounded-md border border-border bg-secondary px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-border hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setDeleting(true)
                    try {
                      await onDeleteTemplate(userTemplateId)
                    } catch {
                      setDeleting(false)
                      setShowDeleteConfirm(false)
                    }
                  }}
                  disabled={deleting}
                  className="rounded-md bg-red-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {deleting ? 'Deleting...' : 'Delete Template'}
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
              placeholder="e.g., ((Player First Name)), I'm interested in your program"
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
              </div>
            </div>
            <textarea
              ref={bodyRef}
              id="body"
              rows={14}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email here..."
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          {/* Merge Tags */}
          <div className="mt-6">
            <h4 className="mb-2 text-xs font-medium text-foreground">Insert Merge Tag</h4>
            <div className="flex flex-wrap gap-1.5">
              {mergeTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => insertMergeTag(tag)}
                  className="rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-foreground"
                >
                  {`((${tag}))`}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Template Preview Overlay ────────────────────────────────────
function TemplatePreviewOverlay({
  template,
  mergeData,
  loading,
  firstCoach,
  onClose,
}: {
  template: EmailTemplate
  mergeData: Record<string, string> | null
  loading: boolean
  firstCoach: SelectedCoach | null
  onClose: () => void
}) {
  // Resolve all merge tags for preview display
  const resolvePreview = (text: string): string => {
    if (!mergeData) return text

    // Use real coach data from the first targeted coach
    const coachName = firstCoach?.coachName || ''
    const coachLast = coachName.split(' ').pop() || ''
    const coachFirst = coachName.split(' ')[0] || ''
    const rawSchoolName = firstCoach?.programName || ''
    const schoolName = rawSchoolName.replace(/\s+-\s+.+$/, '')
    const schoolNameWithThe = /^(University of|College of)/i.test(schoolName)
      ? 'the ' + schoolName
      : schoolName

    // Target college coach data (the recipient)
    const coachValues: Record<string, string> = {
      'Coach Last Name': coachLast,
      'Coach First Name': coachFirst,
      'School Name': schoolName,
      'School Name with The': schoolNameWithThe,
    }
    // NOTE: ((Coach Name)), ((Coach Phone)), ((Coach Email Address)) are the
    // player's HIGH SCHOOL coach — they come from mergeData (the API), NOT
    // from the targeted college coach.

    // Fallbacks when player data is empty in DB
    const fallbacks: Record<string, string> = {
      'Player Film Link': 'https://www.hudl.com/video/example',
      'Player Phone': '(555) 555-1234',
      'Player Email': 'player@example.com',
      'Player GPA': '3.5',
    }

    return text.replace(/\(\(([^)]+)\)\)/g, (_match, rawTag) => {
      const tag = rawTag.trim()

      // 1. Real coach data from targeted list
      if (tag in coachValues && coachValues[tag]) return coachValues[tag]

      // 2. Real player/sender data from the API
      if (mergeData[tag]) return mergeData[tag]
      const alt1 = tag.replace(/_/g, ' ')
      const alt2 = tag.replace(/\s+/g, '_')
      if (mergeData[alt1]) return mergeData[alt1]
      if (mergeData[alt2]) return mergeData[alt2]

      // 3. Fallback for known-empty fields
      if (fallbacks[tag]) return fallbacks[tag]

      // 4. Unknown tag
      return `[${tag}]`
    })
  }

  const resolvedSubject = resolvePreview(template.subject)
  const resolvedBody = resolvePreview(template.body || '')

  return (
    <div className="animate-in fade-in fixed inset-0 z-[80] flex items-center justify-center duration-150">
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative mx-4 flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <Eye className="h-5 w-5 text-primary" />
          <h3 className="flex-1 font-display text-base font-bold uppercase tracking-tight text-foreground">
            Email Preview
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-foreground transition-colors hover:bg-border"
            aria-label="Close preview"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm text-muted-foreground">Loading preview data...</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 py-5">
            {/* Subject */}
            <div className="mb-4">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Subject</p>
              <p className="text-sm font-semibold text-foreground">{resolvedSubject}</p>
            </div>

            {/* Divider */}
            <div className="mb-4 border-t border-border" />

            {/* Body — render newlines as line breaks */}
            <div className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
              {resolvedBody}
            </div>

            {/* Legend for placeholder tags */}
            <div className="mt-6 rounded-lg border border-border bg-secondary/30 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Note</p>
              <p className="text-xs text-muted-foreground">
                {firstCoach
                  ? `Previewing with ${firstCoach.coachName} at ${firstCoach.programName}. Each coach will receive a personalized version.`
                  : 'Select target coaches to see a fully personalized preview.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
