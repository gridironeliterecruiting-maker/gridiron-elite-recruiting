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
import type { CampaignGoal } from "../create-campaign-overlay"

// ─── Merge Tags ─────────────────────────────────────────────────
const MERGE_TAGS = [
  { key: "coach_name", label: "Coach Name", example: "Coach Smith" },
  { key: "school_name", label: "School Name", example: "Iowa" },
  { key: "first_name", label: "Your First Name", example: "Cael" },
  { key: "last_name", label: "Your Last Name", example: "Kongshaug" },
  { key: "position", label: "Position", example: "Quarterback" },
  { key: "grad_year", label: "Class Year", example: "2026" },
  { key: "high_school", label: "High School", example: "Prairie HS" },
  { key: "city_state", label: "City, State", example: "Cedar Rapids, IA" },
  { key: "hudl_url", label: "Hudl Link", example: "https://hudl.com/..." },
  { key: "gpa", label: "GPA", example: "3.8" },
]

// ─── Default Templates ──────────────────────────────────────────
interface EmailTemplate {
  name: string
  subject: string
  body: string
  delayDays: number | null // null = first email (no delay)
}

const GOAL_TEMPLATES: Record<string, EmailTemplate[]> = {
  get_response: [
    {
      name: "Introduction Email",
      subject: "((grad_year)) ((position)) - ((first_name)) ((last_name)), ((high_school)) ((city_state))",
      body: `Dear ((coach_name)),

My name is ((first_name)) ((last_name)), and I'm a ((grad_year)) ((position)) at ((high_school)) in ((city_state)). I'm reaching out because I have a genuine interest in ((school_name)) and your football program.

Here are a few quick highlights about me:
• Position: ((position))
• GPA: ((gpa))
• Class of ((grad_year))

I've attached my highlight film for your review: ((hudl_url))

I would love the opportunity to learn more about your program and what you look for in a recruit. I plan to follow up in a few days, but please don't hesitate to reach out if you have any questions.

Thank you for your time, Coach.

Sincerely,
((first_name)) ((last_name))`,
      delayDays: null,
    },
    {
      name: "Follow Up 1",
      subject: "Following Up - ((first_name)) ((last_name)), ((grad_year)) ((position))",
      body: `Dear ((coach_name)),

I wanted to follow up on my previous email. I'm still very interested in ((school_name)) and would welcome any opportunity to connect with you about your program.

As a reminder, I'm a ((grad_year)) ((position)) at ((high_school)) in ((city_state)). You can view my film here: ((hudl_url))

I understand how busy this time of year is for you. Even a brief reply letting me know if I'm on your radar would mean a lot.

Thank you again for your time.

Best regards,
((first_name)) ((last_name))`,
      delayDays: 4,
    },
    {
      name: "Follow Up 2",
      subject: "Quick Update - ((first_name)) ((last_name)), ((grad_year)) ((position))",
      body: `Dear ((coach_name)),

I hope your season preparation is going well. I wanted to send a quick update and reiterate my interest in ((school_name)).

Since my last email, I've continued working hard both on the field and in the classroom. I'd truly appreciate any feedback on my film if you've had a chance to review it: ((hudl_url))

I'm committed to finding the right program, and ((school_name)) is at the top of my list. I'd love to hear from you when you have a moment.

Thank you,
((first_name)) ((last_name))`,
      delayDays: 5,
    },
    {
      name: "Final Follow Up",
      subject: "Last Check-In - ((first_name)) ((last_name)), ((grad_year)) ((position))",
      body: `Dear ((coach_name)),

I know your inbox is full, so I'll keep this brief. I remain very interested in ((school_name)) and wanted to reach out one final time.

Quick snapshot:
• ((grad_year)) ((position)) at ((high_school))
• GPA: ((gpa))
• Film: ((hudl_url))

If there's any information I can provide to help you evaluate me as a potential fit for your program, I'm happy to send it over. If the timing isn't right, I completely understand.

Thank you for your consideration, Coach.

Respectfully,
((first_name)) ((last_name))`,
      delayDays: 7,
    },
  ],
  evaluate_film: [
    {
      name: "Film Review Request",
      subject: "Film for Review - ((first_name)) ((last_name)), ((grad_year)) ((position))",
      body: `Dear ((coach_name)),

Thank you for your previous communication. I've put together my latest highlight film and would be grateful if you could take a few minutes to evaluate it.

Film link: ((hudl_url))

Key things to look for:
• [Specific skill or play style highlights]

I value your expert eye and any feedback you can provide would help me tremendously in my development. I'm very interested in what ((school_name)) is building.

Thank you for your time,
((first_name)) ((last_name))`,
      delayDays: null,
    },
    {
      name: "Film Follow Up",
      subject: "Following Up on Film - ((first_name)) ((last_name))",
      body: `Dear ((coach_name)),

I wanted to check in to see if you've had a chance to review my film: ((hudl_url))

I understand you're evaluating many athletes, and I appreciate your time. Any feedback — even brief — would be incredibly helpful as I continue developing my game.

Thank you, Coach.

Best,
((first_name)) ((last_name))`,
      delayDays: 5,
    },
  ],
  build_interest: [
    {
      name: "My Story",
      subject: "More About Me - ((first_name)) ((last_name)), ((grad_year)) ((position))",
      body: `Dear ((coach_name)),

I wanted to share a bit more about who I am beyond the stats and film.

[Share your story — what drives you, your work ethic, leadership, community involvement, academic goals, why football matters to you]

Academically, I carry a ((gpa)) GPA and take my classroom performance as seriously as my performance on the field. I believe ((school_name)) is the kind of program where I can grow both as an athlete and as a student.

I'd love to continue our conversation and learn more about the culture you're building.

Thank you,
((first_name)) ((last_name))`,
      delayDays: null,
    },
    {
      name: "Interest Builder Follow Up",
      subject: "Continued Interest in ((school_name)) - ((first_name)) ((last_name))",
      body: `Dear ((coach_name)),

I continue to be very impressed with ((school_name)) and your program's direction. I'd love any opportunity to connect — whether a phone call, video chat, or an upcoming camp or visit.

Please let me know if there's a good time that works for you.

Best regards,
((first_name)) ((last_name))`,
      delayDays: 5,
    },
  ],
  secure_visit: [
    {
      name: "Visit Request",
      subject: "Visit Inquiry - ((first_name)) ((last_name)), ((grad_year)) ((position))",
      body: `Dear ((coach_name)),

I've really enjoyed getting to know more about ((school_name)) and your program. I'd love to take the next step and visit campus if possible.

I'm available on [dates] and would be thrilled to see the facilities, meet the team, and learn more about the program in person.

Would any upcoming dates work for an unofficial visit? I'm also open to a virtual meeting if that's more convenient.

Thank you for considering this, Coach.

Best,
((first_name)) ((last_name))`,
      delayDays: null,
    },
    {
      name: "Visit Follow Up",
      subject: "Following Up on Visit - ((first_name)) ((last_name))",
      body: `Dear ((coach_name)),

I wanted to follow up on my visit request. I'm flexible on dates and happy to work around your schedule. Visiting ((school_name)) is a priority for me and my family.

Please let me know if there's a good time to connect about scheduling.

Thank you,
((first_name)) ((last_name))`,
      delayDays: 5,
    },
  ],
}

// ─── Component ──────────────────────────────────────────────────
interface BuildStepProps {
  goal: CampaignGoal
  templates: EmailTemplate[]
  onTemplatesChange: (templates: EmailTemplate[]) => void
  onNext: () => void
  onBack: () => void
}

// All available templates for the template library
const TEMPLATE_LIBRARY: EmailTemplate[] = [
  ...GOAL_TEMPLATES.get_response,
  ...GOAL_TEMPLATES.evaluate_film,
  ...GOAL_TEMPLATES.build_interest,
  ...GOAL_TEMPLATES.secure_visit,
]

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
        <>
        <div className="fixed inset-0 z-[65] bg-foreground/20 backdrop-blur-sm" onClick={() => setEditingIndex(null)} />
        <TemplateEditorOverlay
          key={editingIndex}
          template={templates[editingIndex]}
          index={editingIndex}
          onUpdate={(updates) => updateTemplate(editingIndex, updates)}
          onClose={() => setEditingIndex(null)}
        />
        </>
      )}

      {/* Add Template Overlay */}
      {showAddOverlay && (
        <>
        <div className="fixed inset-0 z-[65] bg-foreground/20 backdrop-blur-sm" onClick={() => setShowAddOverlay(false)} />
        <AddTemplateOverlay
          existingNames={templates.map((t) => t.name)}
          onAdd={addTemplates}
          onClose={() => setShowAddOverlay(false)}
        />
        </>
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
    <div className="animate-in slide-in-from-right-8 fade-in fixed inset-0 z-[70] flex w-full flex-col bg-background duration-200">
      <div className="flex items-center gap-4 sticky top-0 z-10 border-b border-border bg-card px-4 py-3 shadow-sm lg:px-8">
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
    <div className="animate-in slide-in-from-right-8 fade-in fixed inset-0 z-[70] flex w-full flex-col bg-background duration-200">
      {/* Header */}
      <div className="flex items-center gap-4 sticky top-0 z-10 border-b border-border bg-card px-4 py-3 shadow-sm lg:px-8">
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
export type { EmailTemplate }
