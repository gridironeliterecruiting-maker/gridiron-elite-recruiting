"use client"

import { useState } from "react"
import { X, Save, Trash2 } from "lucide-react"

interface SaveDraftDialogProps {
  isOpen: boolean
  onSave: (title: string) => void
  onDelete: () => void
  onCancel: () => void
  defaultTitle?: string
}

export function SaveDraftDialog({ isOpen, onSave, onDelete, onCancel, defaultTitle = "Untitled Campaign" }: SaveDraftDialogProps) {
  const [title, setTitle] = useState(defaultTitle)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" onClick={onCancel} />
      
      {/* Dialog */}
      <div className="relative z-10 w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
        <div className="rounded-lg border border-border bg-card p-6 shadow-lg">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold uppercase tracking-tight text-foreground">
              Save Campaign?
            </h2>
            <button
              onClick={onCancel}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="mb-4 text-sm text-muted-foreground">
            Would you like to save your progress as a draft or delete this campaign?
          </p>

          <div className="mb-6">
            <label htmlFor="campaign-title" className="mb-2 block text-sm font-medium text-foreground">
              Campaign Title
            </label>
            <input
              id="campaign-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Enter campaign title..."
              autoFocus
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => onSave(title)}
              disabled={!title.trim()}
              className="flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              Save as Draft
            </button>
            <button
              onClick={onDelete}
              className="flex items-center justify-center gap-2 rounded-md border border-destructive px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}