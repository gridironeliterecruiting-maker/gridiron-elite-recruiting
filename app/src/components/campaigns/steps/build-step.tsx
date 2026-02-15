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
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { CampaignGoal, EmailTemplate } from "../types"

export function BuildStep({ goal, templates, onTemplatesChange, onNext, onBack }: BuildStepProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [showAddOverlay, setShowAddOverlay] = useState(false)

  // Initialize templates from defaults if empty
  useEffect(() => {
    if (templates.length === 0) {
      onTemplatesChange(GOAL_TEMPLATES[goal] || GOAL_TEMPLATES.get_response)
    }
  }, [goal]) // eslint-disable-line react-hooks/exhaustive-deps

  const updateTemplate = (index: number, updates: Partial<EmailTemplate>) => {
    let updated = templates.map((t, i) => (i === index ? { ...t, ...updates } : t))
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

  return (
    <div className="relative">
      <div className="mb-6">
        <h2 className="mb-2 font-display text-base font-bold uppercase tracking-wider text-foreground">
          Build
        </h2>
        <p className="text-sm text-muted-foreground">
          Recommended email sequence based on your goal. Click any email to customize.
          Delete unwanted templates or{" "}
          <button
            type="button"
            onClick={() => setShowAddOverlay(true)}
            className="font-semibold text-primary hover:underline"
          >
            add a template
          </button>
          .
        </p>
      </div>

      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Recommended Sequence
      </div>

      <div className="flex flex-col gap-3">
        {templates.map((template, index) => (
          <div key={`${template.name}-${index}`} className="group relative">
            <button
              type="button"
              onClick={() => setEditingIndex(index)}
              className="w-full text-left"
            >
              <Card className="overflow-hidden transition-all group-hover:ring-1 group-hover:ring-primary/20 group-hover:shadow-sm">
                <div className="flex items-start gap-4 p-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {index + 1}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{template.name}</p>
                      {template.delayDays !== null && (
                        <Badge variant="outline" className="border border-border bg-secondary text-[10px] font-semibold text-muted-foreground">
                          <Clock className="mr-1 h-2.5 w-2.5" />
                          after {template.delayDays} days
                        </Badge>
                      )}
                      {template.delayDays === null && index === 0 && (
                        <Badge variant="outline" className="border border-primary/20 bg-primary/10 text-[10px] font-semibold text-primary">
                          First Email
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground truncate">
                      Subject: {template.subject}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground/70 line-clamp-2">
                      {template.body.slice(0, 150)}...
                    </p>
                  </div>

                  <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground/30 transition-colors group-hover:text-primary" />
                </div>
              </Card>
            </button>

            {/* Delete button — shows on hover */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                deleteTemplate(index)
              }}
              className="absolute bottom-3 right-3 flex h-7 w-7 items-center justify-center rounded-md bg-secondary text-muted-foreground/0 transition-all group-hover:text-destructive hover:!bg-destructive/10"
              title="Remove from sequence"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        {templates.length === 0 && (
          <Card className="flex flex-col items-center justify-center p-8 text-center">
            <Mail className="mb-2 h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm font-semibold text-foreground">No emails in sequence</p>
            <p className="mt-1 text-xs text-muted-foreground">
              <button
                type="button"
                onClick={() => setShowAddOverlay(true)}
                className="font-semibold text-primary hover:underline"
              >
                Add a template
              </button>{" "}
              to get started.
            </p>
          </Card>
        )}
      </div>

      {/* Navigation */}
      <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md bg-secondary px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-secondary/80"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={templates.length === 0}
          className="rounded-md bg-primary px-6 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next — Review & Launch
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
        />
      )}

      {/* Add Template Overlay */}
      {showAddOverlay && (
        <AddTemplateOverlay
          existingNames={templates.map((t) => t.name)}
          onAdd={addTemplates}
          onClose={() => setShowAddOverlay(false)}
        />
      )}
    </div>
  )
}

// ─── Add Template Overlay ───────────────────────────────────────
function AddTemplateOverlay({
  existingNames,
  onAdd,
  onClose,
}: {
  existingNames: string[]
  onAdd: (templates: EmailTemplate[]) => void
  onClose: () => void
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const toggleTemplate = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const handleAdd = () => {
    const toAdd = Array.from(selected).map((i) => TEMPLATE_LIBRARY[i])
    onAdd(toAdd)
  }

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
        <p className="mb-4 text-xs text-muted-foreground">
          Select one or more templates to add to your sequence.
        </p>
        <div className="flex flex-col gap-2">
          {TEMPLATE_LIBRARY.map((template, index) => {
            const isSelected = selected.has(index)
            const alreadyInSequence = existingNames.includes(template.name)
            return (
              <button
                key={index}
                type="button"
                onClick={() => !alreadyInSequence && toggleTemplate(index)}
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
                      : "border-border bg-card"
                  }`}
                >
                  {isSelected && <Check className="h-3 w-3" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{template.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground truncate">
                    {template.body.slice(0, 80)}...
                  </p>
                </div>
                {alreadyInSequence && (
                  <Badge variant="outline" className="border-0 bg-secondary text-[9px] text-muted-foreground">
                    Already added
                  </Badge>
                )}
              </button>
            )
          })}
        </div>
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
}: {
  template: EmailTemplate
  index: number
  onUpdate: (updates: Partial<EmailTemplate>) => void
  onClose: () => void
}) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [subject, setSubject] = useState(template.subject)
  const [delayDays, setDelayDays] = useState(template.delayDays)

  // Initialize editor content
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = renderMergeTags(template.body)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = () => {
    const body = extractPlainText(editorRef.current?.innerHTML || "")
    onUpdate({ subject, body, delayDays })
    onClose()
  }

  const insertMergeTag = (tag: string) => {
    if (!editorRef.current) return
    const sel = window.getSelection()
    const tagHtml = `<span class="merge-tag" contenteditable="false" data-tag="${tag}">((${tag.replace(/_/g, " ")}))</span>&nbsp;`

    if (sel && sel.rangeCount > 0 && editorRef.current.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0)
      range.deleteContents()
      const frag = document.createRange().createContextualFragment(tagHtml)
      range.insertNode(frag)
      range.collapse(false)
    } else {
      editorRef.current.innerHTML += tagHtml
    }
  }

  const execCommand = (cmd: string) => {
    document.execCommand(cmd, false)
    editorRef.current?.focus()
  }

  return (
    <div className="animate-in slide-in-from-right-8 fade-in fixed inset-0 z-[70] overflow-y-auto duration-200">
      <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-lg flex-col overflow-hidden bg-card shadow-2xl sm:rounded-l-2xl">
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
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
            {index + 1}
          </div>
          <h3 className="font-display text-lg font-bold uppercase tracking-tight text-foreground truncate">
            {template.name}
          </h3>
        </div>
        <button
          type="button"
          onClick={handleSave}
          className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Save
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Delay */}
        {template.delayDays !== null && (
          <div className="mb-4 flex items-center gap-3">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Send after</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setDelayDays(Math.max(1, (delayDays || 1) - 1))}
                className="flex h-7 w-7 items-center justify-center rounded border border-border bg-secondary text-muted-foreground hover:text-foreground"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="w-8 text-center text-sm font-bold text-foreground">{delayDays}</span>
              <button
                type="button"
                onClick={() => setDelayDays((delayDays || 1) + 1)}
                className="flex h-7 w-7 items-center justify-center rounded border border-border bg-secondary text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
            <span className="text-xs text-muted-foreground">days</span>
          </div>
        )}

        {/* Subject */}
        <div className="mb-4">
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Subject Line
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/30 focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>

        {/* Merge Tags */}
        <div className="mb-4">
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Insert Variable
          </label>
          <div className="flex flex-wrap gap-1.5">
            {MERGE_TAGS.map((tag) => (
              <button
                key={tag.key}
                type="button"
                onClick={() => insertMergeTag(tag.key)}
                className="rounded-md border border-primary/20 bg-primary/5 px-2 py-1 text-[10px] font-semibold text-primary transition-colors hover:bg-primary/10"
              >
                {tag.label}
              </button>
            ))}
          </div>
        </div>

        {/* Toolbar */}
        <div className="mb-2 flex items-center gap-1 rounded-t-md border border-b-0 border-border bg-secondary/50 px-2 py-1.5">
          <button type="button" onClick={() => execCommand("bold")} className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" title="Bold">
            <Bold className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => execCommand("italic")} className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" title="Italic">
            <Italic className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => execCommand("underline")} className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" title="Underline">
            <Underline className="h-3.5 w-3.5" />
          </button>
          <div className="mx-1 h-4 w-px bg-border" />
          <button type="button" onClick={() => execCommand("insertUnorderedList")} className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" title="Bullet List">
            <List className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => execCommand("justifyLeft")} className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" title="Align Left">
            <AlignLeft className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Editor */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          className="min-h-[300px] rounded-b-md border border-border bg-card p-4 text-sm leading-relaxed text-foreground focus:border-primary/30 focus:outline-none focus:ring-1 focus:ring-primary/30 [&_.merge-tag]:inline-block [&_.merge-tag]:rounded [&_.merge-tag]:bg-primary/10 [&_.merge-tag]:px-1.5 [&_.merge-tag]:py-0.5 [&_.merge-tag]:text-xs [&_.merge-tag]:font-semibold [&_.merge-tag]:text-primary [&_.merge-tag]:cursor-default"
          style={{ whiteSpace: "pre-wrap" }}
        />
      </div>
      </div>
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────
function renderMergeTags(text: string): string {
  return text.replace(
    /\(\(([^)]+)\)\)/g,
    (_, tag) => {
      const key = tag.replace(/\s+/g, "_")
      return `<span class="merge-tag" contenteditable="false" data-tag="${key}">((${tag}))</span>`
    }
  )
}

function extractPlainText(html: string): string {
  // Convert merge tag spans back to ((tag)) format
  let text = html.replace(
    /<span[^>]*class="merge-tag"[^>]*data-tag="([^"]*)"[^>]*>.*?<\/span>/g,
    (_, tag) => `((${tag}))`
  )
  // Convert <br> and block elements to newlines
  text = text.replace(/<br\s*\/?>/gi, "\n")
  text = text.replace(/<\/?(div|p|li|ul|ol)[^>]*>/gi, "\n")
  // Strip remaining HTML
  text = text.replace(/<[^>]*>/g, "")
  // Decode entities
  text = text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
  // Clean up excess newlines
  text = text.replace(/\n{3,}/g, "\n\n").trim()
  return text
}

export { GOAL_TEMPLATES }
