"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Plus,
  Link2,
  FileText,
  Video,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  Check,
  Upload,
  ExternalLink,
  GripVertical,
  FolderOpen,
  Share2,
  Loader2,
} from "lucide-react"

interface Document {
  id: string
  title: string
  description: string | null
  type: "link" | "file" | "video"
  url: string | null
  file_path: string | null
  file_name: string | null
  file_size: number | null
  file_type: string | null
  display_order: number
  is_visible: boolean
}

export function RecruitingDrive() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [shareSlug, setShareSlug] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addType, setAddType] = useState<"link" | "file" | "video">("link")
  const [addTitle, setAddTitle] = useState("")
  const [addDescription, setAddDescription] = useState("")
  const [addUrl, setAddUrl] = useState("")
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Drag state
  const [dragState, setDragState] = useState<{
    active: boolean
    index: number
    startY: number
    currentY: number
    rowHeight: number
  } | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const rowHeightsRef = useRef<number[]>([])
  const documentsRef = useRef(documents)
  documentsRef.current = documents

  // Load documents and share slug on mount
  useEffect(() => {
    loadDocuments()
    loadShareSlug()
  }, [])

  async function loadDocuments() {
    try {
      const res = await fetch("/api/documents")
      const data = await res.json()
      setDocuments(data.documents || [])
    } catch {
      console.error("Failed to load documents")
    } finally {
      setLoading(false)
    }
  }

  async function loadShareSlug() {
    try {
      const res = await fetch("/api/documents/share-link")
      const data = await res.json()
      setShareSlug(data.slug || null)
    } catch {
      console.error("Failed to load share link")
    }
  }

  async function handleCopyShareLink() {
    if (!shareSlug) return
    const url = `${window.location.origin}/recruit/${shareSlug}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const textarea = document.createElement("textarea")
      textarea.value = url
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand("copy")
      document.body.removeChild(textarea)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleAddLink() {
    if (!addTitle.trim()) return
    if ((addType === "link" || addType === "video") && !addUrl.trim()) return

    setSaving(true)
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: addTitle.trim(),
          description: addDescription.trim() || null,
          type: addType,
          url: addUrl.trim(),
        }),
      })
      const data = await res.json()
      if (data.document) {
        setDocuments((prev) => [...prev, data.document])
        resetAddForm()
      }
    } catch {
      console.error("Failed to add document")
    } finally {
      setSaving(false)
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!addTitle.trim()) {
      setAddTitle(file.name.replace(/\.[^.]+$/, ""))
    }

    setUploading(true)
    try {
      // Upload file first
      const formData = new FormData()
      formData.append("file", file)

      const uploadRes = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      })
      const uploadData = await uploadRes.json()

      if (uploadData.error) {
        alert(uploadData.error)
        return
      }

      // Create document record
      const title = addTitle.trim() || file.name.replace(/\.[^.]+$/, "")
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: addDescription.trim() || null,
          type: "file",
          url: uploadData.publicUrl,
          filePath: uploadData.filePath,
          fileName: uploadData.fileName,
          fileSize: uploadData.fileSize,
          fileType: uploadData.fileType,
        }),
      })
      const data = await res.json()
      if (data.document) {
        setDocuments((prev) => [...prev, data.document])
        resetAddForm()
      }
    } catch {
      console.error("Failed to upload file")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function handleToggleVisibility(doc: Document) {
    try {
      await fetch("/api/documents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: doc.id, isVisible: !doc.is_visible }),
      })
      setDocuments((prev) =>
        prev.map((d) => (d.id === doc.id ? { ...d, is_visible: !d.is_visible } : d))
      )
    } catch {
      console.error("Failed to toggle visibility")
    }
  }

  async function handleDelete(doc: Document) {
    if (!confirm(`Delete "${doc.title}"? This cannot be undone.`)) return
    try {
      await fetch(`/api/documents?id=${doc.id}`, { method: "DELETE" })
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id))
    } catch {
      console.error("Failed to delete document")
    }
  }

  function handlePointerDown(e: React.PointerEvent, index: number) {
    // Only start drag from the grip handle
    const target = e.target as HTMLElement
    if (!target.closest("[data-drag-handle]")) return

    e.preventDefault()
    const listEl = listRef.current
    if (!listEl) return

    // Measure row heights
    const rows = listEl.querySelectorAll("[data-drag-row]")
    rowHeightsRef.current = Array.from(rows).map((r) => (r as HTMLElement).offsetHeight + 6) // 6px = gap

    const row = rows[index] as HTMLElement
    const rect = row.getBoundingClientRect()

    setDragState({
      active: true,
      index,
      startY: e.clientY,
      currentY: e.clientY,
      rowHeight: rect.height,
    })

    // Capture pointer for smooth tracking
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState?.active) return
    e.preventDefault()

    const newY = e.clientY
    const delta = newY - dragState.startY
    const heights = rowHeightsRef.current
    const fromIndex = dragState.index

    // Calculate how many positions to shift based on delta
    let newIndex = fromIndex
    let accumulated = 0

    if (delta > 0) {
      // Moving down
      for (let i = fromIndex + 1; i < documents.length; i++) {
        accumulated += heights[i]
        if (delta > accumulated - heights[i] / 2) {
          newIndex = i
        } else {
          break
        }
      }
    } else {
      // Moving up
      for (let i = fromIndex - 1; i >= 0; i--) {
        accumulated -= heights[i]
        if (delta < accumulated + heights[i] / 2) {
          newIndex = i
        } else {
          break
        }
      }
    }

    if (newIndex !== fromIndex) {
      // Reorder the list
      setDocuments((prev) => {
        const updated = [...prev]
        const [moved] = updated.splice(fromIndex, 1)
        updated.splice(newIndex, 0, moved)
        return updated
      })

      // Recalculate start position so delta stays correct relative to new position
      const shiftDir = newIndex > fromIndex ? 1 : -1
      let shiftAmount = 0
      const minI = Math.min(fromIndex, newIndex)
      const maxI = Math.max(fromIndex, newIndex)
      for (let i = minI; i <= maxI; i++) {
        if (i !== fromIndex) shiftAmount += heights[i]
      }

      setDragState((prev) => prev ? {
        ...prev,
        index: newIndex,
        startY: prev.startY + shiftDir * shiftAmount,
        currentY: newY,
      } : null)
    } else {
      setDragState((prev) => prev ? { ...prev, currentY: newY } : null)
    }
  }, [dragState, documents])

  const handlePointerUp = useCallback(() => {
    if (!dragState?.active) return

    setDragState(null)

    // Persist final order
    const finalDocs = documentsRef.current.map((doc, i) => ({ ...doc, display_order: i }))
    setDocuments(finalDocs)

    for (const doc of finalDocs) {
      fetch("/api/documents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: doc.id, displayOrder: doc.display_order }),
      }).catch(() => console.error("Failed to save order for", doc.id))
    }
  }, [dragState])

  function resetAddForm() {
    setShowAddForm(false)
    setAddType("link")
    setAddTitle("")
    setAddDescription("")
    setAddUrl("")
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const typeIcon = (type: string) => {
    switch (type) {
      case "video": return <Video className="h-4 w-4" />
      case "file": return <FileText className="h-4 w-4" />
      default: return <Link2 className="h-4 w-4" />
    }
  }

  const typeColor = (type: string) => {
    switch (type) {
      case "video": return "bg-red-50 text-red-600"
      case "file": return "bg-amber-50 text-amber-600"
      default: return "bg-blue-50 text-blue-600"
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Share link card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Share2 className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Your Recruiting Page
              </p>
              {shareSlug ? (
                <p className="truncate text-sm text-primary">
                  {typeof window !== "undefined" ? window.location.origin : ""}/recruit/{shareSlug}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Generating...</p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyShareLink}
              disabled={!shareSlug}
              className="shrink-0"
            >
              {copied ? (
                <><Check className="mr-1 h-3 w-3" /> Copied</>
              ) : (
                <><Copy className="mr-1 h-3 w-3" /> Copy Link</>
              )}
            </Button>
            {shareSlug && (
              <a
                href={`/recruit/${shareSlug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0"
              >
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </a>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Documents list */}
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <FolderOpen className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-base">Recruiting Drive</CardTitle>
          </div>
          <Button
            size="sm"
            onClick={() => setShowAddForm(true)}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add Item
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Add form */}
          {showAddForm && (
            <div className="mb-4 rounded-lg border border-border bg-secondary/30 p-4">
              {/* Type selector */}
              <div className="mb-3 flex gap-1.5">
                {(["link", "video", "file"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setAddType(t)}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${
                      addType === t
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {typeIcon(t)}
                    {t}
                  </button>
                ))}
              </div>

              {/* Title */}
              <input
                type="text"
                value={addTitle}
                onChange={(e) => setAddTitle(e.target.value)}
                placeholder="Title (e.g., Junior Year Highlights)"
                className="mb-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />

              {/* Description */}
              <input
                type="text"
                value={addDescription}
                onChange={(e) => setAddDescription(e.target.value)}
                placeholder="Description (optional)"
                className="mb-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />

              {/* URL or file upload */}
              {addType === "file" ? (
                <div className="mb-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileUpload}
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-background px-3 py-4 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    {uploading ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Uploading...</>
                    ) : (
                      <><Upload className="h-4 w-4" /> Choose File (PDF, Image, Doc — max 10MB)</>
                    )}
                  </button>
                </div>
              ) : (
                <input
                  type="url"
                  value={addUrl}
                  onChange={(e) => setAddUrl(e.target.value)}
                  placeholder={addType === "video" ? "https://www.hudl.com/video/..." : "https://..."}
                  className="mb-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              )}

              {/* Actions */}
              <div className="flex items-center gap-2">
                {addType !== "file" && (
                  <Button
                    size="sm"
                    onClick={handleAddLink}
                    disabled={saving || !addTitle.trim() || !addUrl.trim()}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {saving ? "Saving..." : "Add"}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={resetAddForm}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Documents list */}
          {loading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : documents.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                <FolderOpen className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">No items yet</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Add transcripts, highlight videos, and other recruiting materials coaches need to see.
                </p>
              </div>
            </div>
          ) : (
            <div
              ref={listRef}
              className="relative flex flex-col gap-1.5"
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            >
              {documents.map((doc, index) => {
                const isDragging = dragState?.active && dragState.index === index
                const dragOffset = isDragging ? dragState.currentY - dragState.startY : 0

                return (
                <div
                  key={doc.id}
                  data-drag-row
                  onPointerDown={(e) => handlePointerDown(e, index)}
                  style={isDragging ? {
                    position: "relative",
                    zIndex: 50,
                    transform: `translateY(${dragOffset}px)`,
                    pointerEvents: "none",
                  } : undefined}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 select-none ${
                    isDragging
                      ? "border-primary bg-card shadow-lg ring-1 ring-primary/30"
                      : dragState?.active
                        ? "transition-transform duration-200"
                        : "group"
                  } ${
                    !isDragging && doc.is_visible
                      ? "border-transparent hover:border-border hover:bg-secondary/30"
                      : !isDragging
                        ? "border-dashed border-border/50 bg-secondary/20 opacity-60"
                        : ""
                  }`}
                >
                  {/* Drag handle */}
                  <div data-drag-handle className="shrink-0 cursor-grab text-muted-foreground/30 transition-colors hover:text-muted-foreground active:cursor-grabbing touch-none">
                    <GripVertical className="h-4 w-4" />
                  </div>

                  {/* Type icon */}
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${typeColor(doc.type)}`}>
                    {typeIcon(doc.type)}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{doc.title}</p>
                    {doc.description && (
                      <p className="text-[11px] text-muted-foreground">{doc.description}</p>
                    )}
                    {doc.file_name && doc.file_size && (
                      <p className="text-[10px] text-muted-foreground">
                        {doc.file_name} · {formatFileSize(doc.file_size)}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className={`flex shrink-0 items-center gap-1 transition-opacity ${isDragging ? "opacity-0" : "opacity-0 group-hover:opacity-100"}`}>
                    {doc.url && (
                      <a href={doc.url} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => handleToggleVisibility(doc)}
                      title={doc.is_visible ? "Hide from coaches" : "Show to coaches"}
                    >
                      {doc.is_visible ? (
                        <Eye className="h-3.5 w-3.5" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(doc)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
