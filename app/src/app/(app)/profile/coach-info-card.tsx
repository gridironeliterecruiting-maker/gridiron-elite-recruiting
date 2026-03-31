"use client"

import { useState } from "react"
import { Check, Pencil } from "lucide-react"

interface CoachInfoCardProps {
  firstName: string
  lastName: string
  title: string
  programName: string
  loginEmail: string
  recruitingEmail: string | null
}

export function CoachInfoCard({
  firstName,
  lastName,
  title: initialTitle,
  programName,
  loginEmail,
  recruitingEmail,
}: CoachInfoCardProps) {
  const [title, setTitle] = useState(initialTitle)
  const [editingTitle, setEditingTitle] = useState(false)
  const [saving, setSaving] = useState(false)

  const saveTitle = async () => {
    const trimmed = title.trim() || "Head Coach"
    setTitle(trimmed)
    setSaving(true)
    setEditingTitle(false)
    await fetch("/api/profile/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    }).catch(() => {})
    setSaving(false)
  }

  return (
    <div className="rounded-xl border bg-card p-6">
      <h2 className="mb-4 font-display text-lg font-bold uppercase tracking-tight">Coach Info</h2>
      <div className="space-y-3">
        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">Name</p>
          <p className="text-sm font-semibold">{firstName} {lastName}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">Title</p>
          {editingTitle ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") { setTitle(initialTitle); setEditingTitle(false) } }}
                autoFocus
                className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm font-semibold text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={saveTitle}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{saving ? "Saving..." : title}</p>
              <button
                type="button"
                onClick={() => setEditingTitle(true)}
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
              >
                <Pencil className="h-3 w-3" /> Edit
              </button>
            </div>
          )}
        </div>
        {programName && (
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Program</p>
            <p className="text-sm font-semibold">{programName}</p>
          </div>
        )}
        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">Login Email</p>
          <p className="text-sm font-semibold">{loginEmail}</p>
        </div>
        {recruitingEmail && (
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Recruiting Email</p>
            <p className="text-sm font-semibold">{recruitingEmail}</p>
          </div>
        )}
      </div>
    </div>
  )
}
