"use client"

import { useState } from 'react'
import { X } from 'lucide-react'

interface CustomTemplateCreatorProps {
  onSave: (template: { name: string; subject: string; body: string }) => Promise<void>
  onClose: () => void
}

// Available merge tags for the template editor
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

export function CustomTemplateCreator({ onSave, onClose }: CustomTemplateCreatorProps) {
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const insertMergeTag = (tag: string) => {
    // Insert at cursor position
    const textarea = document.getElementById('template-body') as HTMLTextAreaElement
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newBody = body.slice(0, start) + `((${tag}))` + body.slice(end)
      setBody(newBody)
      // Reset cursor position after React re-render
      setTimeout(() => {
        textarea.selectionStart = start + tag.length + 4
        textarea.selectionEnd = start + tag.length + 4
        textarea.focus()
      }, 0)
    }
  }

  const handleSave = async () => {
    // Validate
    if (!name.trim()) {
      setError('Template name is required')
      return
    }
    if (!subject.trim()) {
      setError('Subject line is required')
      return
    }
    if (!body.trim()) {
      setError('Email body is required')
      return
    }

    setSaving(true)
    setError('')
    
    try {
      await onSave({
        name: name.trim(),
        subject: subject.trim(),
        body: body.trim()
      })
    } catch (err) {
      setError('Failed to save template')
      setSaving(false)
    }
  }

  return (
    <div className="animate-in slide-in-from-right-8 fade-in fixed inset-0 z-[80] overflow-y-auto duration-200">
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
            Create Custom Email
          </h3>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Template'}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-6">
          {error && (
            <div className="mb-4 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

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
              placeholder="e.g., Personalized Introduction"
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Subject Line */}
          <div className="mb-6">
            <label htmlFor="template-subject" className="mb-2 block text-xs font-medium text-foreground">
              Subject Line
            </label>
            <input
              id="template-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., ((First Name)), I'm Interested in Your Program"
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Email Body */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor="template-body" className="block text-xs font-medium text-foreground">
                Email Body
              </label>
              <span className="text-[10px] text-muted-foreground">
                Use ((merge tags)) to personalize
              </span>
            </div>
            
            {/* Merge Tag Pills */}
            <div className="mb-3 flex flex-wrap gap-1.5">
              {MERGE_TAGS.map((tag) => (
                <button
                  key={tag.key}
                  type="button"
                  onClick={() => insertMergeTag(tag.label)}
                  className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  {tag.label}
                </button>
              ))}
            </div>

            <textarea
              id="template-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Dear Coach ((Coach Name)),&#10;&#10;My name is ((First Name)) ((Last Name)), and I'm a ((Position)) from ((High School))..."
              rows={12}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Tips */}
          <div className="mt-6 rounded-md border border-border bg-secondary/50 p-4">
            <h4 className="mb-2 text-xs font-semibold text-foreground">Tips for Great Templates</h4>
            <ul className="space-y-1 text-[10px] text-muted-foreground">
              <li>• Keep it personal and authentic to the athlete's voice</li>
              <li>• Use merge tags to personalize each email</li>
              <li>• Focus on why they're interested in that specific program</li>
              <li>• Keep initial emails short (3-5 sentences)</li>
              <li>• Always include a clear call-to-action</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}