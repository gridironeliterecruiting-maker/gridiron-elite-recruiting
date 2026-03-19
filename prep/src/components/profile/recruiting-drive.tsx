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
  Folder,
  Share2,
  Loader2,
  ChevronRight,
} from "lucide-react"

interface Document {
  id: string
  title: string
  description: string | null
  type: "link" | "file" | "video" | "folder"
  url: string | null
  file_path: string | null
  file_name: string | null
  file_size: number | null
  file_type: string | null
  display_order: number
  is_visible: boolean
  folder_id: string | null
}

interface RecruitingDriveProps {
  playerId?: string | null
  readOnly?: boolean
}

export function RecruitingDrive({ playerId, readOnly = false }: RecruitingDriveProps = {}) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [shareSlug, setShareSlug] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addType, setAddType] = useState<"link" | "file" | "video">("link")
  const [addTitle, setAddTitle] = useState("")
  const [addDescription, setAddDescription] = useState("")
  const [addUrl, setAddUrl] = useState("")
  const [addFolderId, setAddFolderId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Folder state
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [showAddFolderForm, setShowAddFolderForm] = useState(false)
  const [addFolderTitle, setAddFolderTitle] = useState("")
  const [savingFolder, setSavingFolder] = useState(false)

  // Drag state — snapshot + transform approach (no state mutations during drag)
  const [dragInfo, setDragInfo] = useState<{
    renderSnapshot: { doc: Document; isChild: boolean; parentFolderId?: string }[]
    fromIndex: number
    currentIndex: number
    startY: number
    currentY: number
    draggedDoc: Document
    rowHeights: number[]
  } | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const documentsRef = useRef(documents)
  documentsRef.current = documents

  // Build the flat render list (top-level items + expanded folder children)
  const folders = documents.filter((d) => d.type === "folder" && d.folder_id === null)
  const folderContents = new Map<string, Document[]>()
  for (const doc of documents) {
    if (doc.folder_id) {
      const list = folderContents.get(doc.folder_id) || []
      list.push(doc)
      folderContents.set(doc.folder_id, list)
    }
  }
  // Sort folder contents by display_order
  for (const [, items] of folderContents) {
    items.sort((a, b) => a.display_order - b.display_order)
  }

  const topLevelDocs = documents
    .filter((d) => d.folder_id === null)
    .sort((a, b) => a.display_order - b.display_order)

  // Build flat render list with folder children inline
  const renderList: { doc: Document; isChild: boolean; parentFolderId?: string }[] = []
  for (const doc of topLevelDocs) {
    renderList.push({ doc, isChild: false })
    if (doc.type === "folder" && expandedFolders.has(doc.id)) {
      const children = folderContents.get(doc.id) || []
      for (const child of children) {
        renderList.push({ doc: child, isChild: true, parentFolderId: doc.id })
      }
    }
  }

  // Load documents and share slug on mount
  useEffect(() => {
    loadDocuments()
    loadShareSlug()
  }, [])

  async function loadDocuments() {
    try {
      const url = playerId ? `/api/documents?playerId=${playerId}` : "/api/documents"
      const res = await fetch(url)
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
      const url = playerId ? `/api/documents/share-link?playerId=${playerId}` : "/api/documents/share-link"
      const res = await fetch(url)
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

  function toggleFolder(folderId: string) {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(folderId)) {
        next.delete(folderId)
      } else {
        next.add(folderId)
      }
      return next
    })
  }

  async function handleAddFolder() {
    if (!addFolderTitle.trim()) return
    setSavingFolder(true)
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: addFolderTitle.trim().toUpperCase(),
          type: "folder",
        }),
      })
      const data = await res.json()
      if (data.document) {
        setDocuments((prev) => [...prev, data.document])
        setAddFolderTitle("")
        setShowAddFolderForm(false)
      }
    } catch {
      console.error("Failed to create folder")
    } finally {
      setSavingFolder(false)
    }
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
          folderId: addFolderId,
        }),
      })
      const data = await res.json()
      if (data.document) {
        setDocuments((prev) => [...prev, data.document])
        // If added to a folder, expand it
        if (addFolderId) {
          setExpandedFolders((prev) => new Set(prev).add(addFolderId))
        }
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
          folderId: addFolderId,
        }),
      })
      const data = await res.json()
      if (data.document) {
        setDocuments((prev) => [...prev, data.document])
        if (addFolderId) {
          setExpandedFolders((prev) => new Set(prev).add(addFolderId))
        }
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
    const message = doc.type === "folder"
      ? `Delete folder "${doc.title}"? Items inside will be moved to the top level.`
      : `Delete "${doc.title}"? This cannot be undone.`
    if (!confirm(message)) return
    try {
      await fetch(`/api/documents?id=${doc.id}`, { method: "DELETE" })
      if (doc.type === "folder") {
        // Move children to top-level in local state
        setDocuments((prev) =>
          prev
            .filter((d) => d.id !== doc.id)
            .map((d) => (d.folder_id === doc.id ? { ...d, folder_id: null } : d))
        )
        setExpandedFolders((prev) => {
          const next = new Set(prev)
          next.delete(doc.id)
          return next
        })
      } else {
        setDocuments((prev) => prev.filter((d) => d.id !== doc.id))
      }
    } catch {
      console.error("Failed to delete document")
    }
  }

  async function moveToFolder(docId: string, folderId: string | null) {
    try {
      await fetch("/api/documents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: docId, folderId }),
      })
      setDocuments((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, folder_id: folderId } : d))
      )
      // Expand the target folder so user sees the item
      if (folderId) {
        setExpandedFolders((prev) => new Set(prev).add(folderId))
      }
    } catch {
      console.error("Failed to move document")
    }
  }

  function handlePointerDown(e: React.PointerEvent, renderIndex: number) {
    const target = e.target as HTMLElement
    if (!target.closest("[data-drag-handle]")) return

    e.preventDefault()
    const listEl = listRef.current
    if (!listEl) return

    const rows = listEl.querySelectorAll("[data-drag-row]")
    const heights = Array.from(rows).map((r) => (r as HTMLElement).offsetHeight + 6)

    const item = renderList[renderIndex]

    // If dragging an expanded folder, collapse it first
    if (item.doc.type === "folder" && expandedFolders.has(item.doc.id)) {
      setExpandedFolders((prev) => {
        const next = new Set(prev)
        next.delete(item.doc.id)
        return next
      })
      // We need to wait for re-render before snapshotting — defer to next frame
      requestAnimationFrame(() => {
        const freshRows = listEl.querySelectorAll("[data-drag-row]")
        const freshHeights = Array.from(freshRows).map((r) => (r as HTMLElement).offsetHeight + 6)
        // Rebuild renderList without the collapsed folder's children
        const freshRenderList: { doc: Document; isChild: boolean; parentFolderId?: string }[] = []
        const docs = documentsRef.current
        const tl = docs.filter((d) => d.folder_id === null).sort((a, b) => a.display_order - b.display_order)
        // The folder we just collapsed won't have children in the list
        const collapsedFolders = new Set(expandedFolders)
        collapsedFolders.delete(item.doc.id)
        for (const d of tl) {
          freshRenderList.push({ doc: d, isChild: false })
          if (d.type === "folder" && collapsedFolders.has(d.id)) {
            const children = docs.filter((c) => c.folder_id === d.id).sort((a, b) => a.display_order - b.display_order)
            for (const child of children) {
              freshRenderList.push({ doc: child, isChild: true, parentFolderId: d.id })
            }
          }
        }
        const freshIndex = freshRenderList.findIndex((r) => r.doc.id === item.doc.id)
        if (freshIndex === -1) return
        setDragInfo({
          renderSnapshot: freshRenderList,
          fromIndex: freshIndex,
          currentIndex: freshIndex,
          startY: e.clientY,
          currentY: e.clientY,
          draggedDoc: item.doc,
          rowHeights: freshHeights,
        })
      })
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      return
    }

    // Snapshot the current render list
    setDragInfo({
      renderSnapshot: [...renderList],
      fromIndex: renderIndex,
      currentIndex: renderIndex,
      startY: e.clientY,
      currentY: e.clientY,
      draggedDoc: item.doc,
      rowHeights: heights,
    })

    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragInfo) return
    e.preventDefault()

    const newY = e.clientY
    const delta = newY - dragInfo.startY
    const { fromIndex, rowHeights: heights, renderSnapshot, draggedDoc } = dragInfo

    // --- Folder drop-target detection (3-zone: top 25% / middle 50% / bottom 25%) ---
    let newDropTarget: string | null = null
    if (draggedDoc.type !== "folder") {
      // Compute the visual center of the dragged row
      let draggedTop = 0
      for (let i = 0; i < fromIndex; i++) draggedTop += heights[i]
      const dragCenter = draggedTop + heights[fromIndex] / 2 + delta

      for (let i = 0; i < renderSnapshot.length; i++) {
        if (i === fromIndex) continue
        const item = renderSnapshot[i]
        if (item.doc.type !== "folder") continue
        let rowTop = 0
        for (let j = 0; j < i; j++) rowTop += heights[j]
        const rowH = heights[i]
        const top25 = rowTop + rowH * 0.25
        const bottom25 = rowTop + rowH * 0.75
        if (dragCenter > top25 && dragCenter < bottom25) {
          newDropTarget = item.doc.id
          break
        }
      }
    }
    setDropTarget(newDropTarget)

    // --- Compute currentIndex from pointer delta ---
    // For folder rows (when dragging a non-folder), use 25%/75% thresholds so the
    // reorder zones match the 3-zone detection and the middle 50% stays as a drop target.
    let newIndex = fromIndex
    if (!newDropTarget) {
      const isFolderRow = (i: number) =>
        renderSnapshot[i].doc.type === "folder" && draggedDoc.type !== "folder"
      let accumulated = 0
      if (delta > 0) {
        for (let i = fromIndex + 1; i < renderSnapshot.length; i++) {
          accumulated += heights[i]
          const threshold = isFolderRow(i)
            ? accumulated - heights[i] * 0.25  // only reorder past bottom 25%
            : accumulated - heights[i] / 2
          if (delta > threshold) {
            newIndex = i
          } else {
            break
          }
        }
      } else {
        for (let i = fromIndex - 1; i >= 0; i--) {
          accumulated -= heights[i]
          const threshold = isFolderRow(i)
            ? accumulated + heights[i] * 0.25  // only reorder past top 25%
            : accumulated + heights[i] / 2
          if (delta < threshold) {
            newIndex = i
          } else {
            break
          }
        }
      }
    }

    setDragInfo((prev) => prev ? { ...prev, currentY: newY, currentIndex: newIndex } : null)
  }, [dragInfo])

  const handlePointerUp = useCallback(() => {
    if (!dragInfo) return

    const droppedOnFolder = dropTarget
    const { draggedDoc, renderSnapshot, fromIndex, currentIndex } = dragInfo

    setDragInfo(null)
    setDropTarget(null)

    // If dropped onto a folder's middle zone
    if (droppedOnFolder && draggedDoc.type !== "folder") {
      moveToFolder(draggedDoc.id, droppedOnFolder)
      return
    }

    // If position didn't change, nothing to do
    if (fromIndex === currentIndex) return

    // Apply the reorder: remove from fromIndex, insert at currentIndex in snapshot order
    const reordered = renderSnapshot.map((r) => r.doc)
    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(currentIndex, 0, moved)

    // Determine folder membership change
    const draggedItem = renderSnapshot[fromIndex]
    const targetItem = renderSnapshot[currentIndex]
    let newFolderId: string | null | undefined = undefined // undefined = no change

    if (draggedItem.isChild && !targetItem.isChild && !targetItem.parentFolderId) {
      // Dragged OUT of a folder to top-level
      newFolderId = null
    } else if (!draggedItem.isChild && targetItem.isChild && targetItem.parentFolderId) {
      // Dragged INTO a folder's child area
      newFolderId = targetItem.parentFolderId
    } else if (draggedItem.isChild && targetItem.isChild
      && draggedItem.parentFolderId !== targetItem.parentFolderId
      && targetItem.parentFolderId) {
      // Dragged from one folder into another folder's child area
      newFolderId = targetItem.parentFolderId
    }

    // Build new documents array with updated display_order and folder_id
    setDocuments((prev) => {
      const updated = prev.map((d) => {
        if (newFolderId !== undefined && d.id === moved.id) {
          return { ...d, folder_id: newFolderId }
        }
        return d
      })
      // Assign display_order based on the reordered snapshot
      const orderMap = new Map<string, number>()
      reordered.forEach((doc, i) => orderMap.set(doc.id, i))
      return updated.map((d) => ({
        ...d,
        display_order: orderMap.has(d.id) ? orderMap.get(d.id)! : d.display_order,
      }))
    })

    // Expand the target folder so user sees the item
    if (newFolderId) {
      setExpandedFolders((prev) => new Set(prev).add(newFolderId!))
    }

    // Persist folder change if needed
    if (newFolderId !== undefined) {
      fetch("/api/documents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: moved.id, folderId: newFolderId }),
      }).catch(() => {})
    }

    // Persist order for all items in the reordered list
    reordered.forEach((doc, i) => {
      fetch("/api/documents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: doc.id, displayOrder: i }),
      }).catch(() => console.error("Failed to save order for", doc.id))
    })
  }, [dragInfo, dropTarget])

  function resetAddForm() {
    setShowAddForm(false)
    setAddType("link")
    setAddTitle("")
    setAddDescription("")
    setAddUrl("")
    setAddFolderId(null)
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
      case "folder": return <Folder className="h-4 w-4" />
      default: return <Link2 className="h-4 w-4" />
    }
  }

  const typeColor = (type: string) => {
    switch (type) {
      case "video": return "bg-red-50 text-red-600"
      case "file": return "bg-amber-50 text-amber-600"
      case "folder": return "bg-blue-50 text-blue-600"
      default: return "bg-blue-50 text-blue-600"
    }
  }

  function computeRowTransform(renderIndex: number): React.CSSProperties | undefined {
    if (!dragInfo) return undefined
    const { fromIndex, currentIndex, startY, currentY, rowHeights } = dragInfo

    if (renderIndex === fromIndex) {
      // The dragged row follows the pointer
      return {
        position: "relative",
        zIndex: 50,
        transform: `translateY(${currentY - startY}px)`,
        pointerEvents: "none",
      }
    }

    // Rows between fromIndex and currentIndex shift to fill the gap
    const min = Math.min(fromIndex, currentIndex)
    const max = Math.max(fromIndex, currentIndex)
    if (renderIndex >= min && renderIndex <= max) {
      const draggedHeight = rowHeights[fromIndex]
      if (fromIndex < currentIndex) {
        // Dragged down: rows between shift UP by dragged height
        return { transform: `translateY(-${draggedHeight}px)` }
      } else {
        // Dragged up: rows between shift DOWN by dragged height
        return { transform: `translateY(${draggedHeight}px)` }
      }
    }

    return undefined
  }

  function renderDocRow(
    doc: Document,
    renderIndex: number,
    isChild: boolean,
  ) {
    const isDragging = !readOnly && dragInfo !== null && dragInfo.fromIndex === renderIndex
    const isDropTarget = !readOnly && dropTarget === doc.id
    const isFolder = doc.type === "folder"
    const isExpanded = expandedFolders.has(doc.id)
    const childCount = folderContents.get(doc.id)?.length || 0
    const transformStyle = !readOnly && dragInfo ? computeRowTransform(renderIndex) : undefined

    return (
      <div
        key={doc.id}
        data-drag-row
        onPointerDown={readOnly ? undefined : (e) => handlePointerDown(e, renderIndex)}
        style={transformStyle}
        className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 select-none ${
          isChild ? "ml-8" : ""
        } ${
          isDragging
            ? "border-primary bg-card shadow-lg ring-1 ring-primary/30"
            : dragInfo && !readOnly
              ? "transition-transform duration-200"
              : "group"
        } ${
          isDropTarget
            ? "border-blue-400 bg-blue-50/50 ring-2 ring-blue-400/50"
            : !isDragging && doc.is_visible
              ? "border-transparent hover:border-border hover:bg-secondary/30"
              : !isDragging
                ? "border-dashed border-border/50 bg-secondary/20 opacity-60"
                : ""
        }`}
      >
        {/* Drag handle (hidden in readOnly mode) */}
        {!readOnly && (
          <div data-drag-handle className="shrink-0 cursor-grab text-muted-foreground/30 transition-colors hover:text-muted-foreground active:cursor-grabbing touch-none">
            <GripVertical className="h-4 w-4" />
          </div>
        )}

        {/* Folder expand/collapse chevron OR type icon */}
        {isFolder ? (
          <button
            type="button"
            onClick={() => toggleFolder(doc.id)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600 transition-colors hover:bg-blue-100"
          >
            <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
          </button>
        ) : (
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${typeColor(doc.type)}`}>
            {typeIcon(doc.type)}
          </div>
        )}

        {/* Content */}
        {isFolder ? (
          <button
            type="button"
            onClick={() => toggleFolder(doc.id)}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            <Folder className="h-4 w-4 shrink-0 text-blue-600" />
            <span className="text-sm font-bold uppercase tracking-wide text-foreground">
              {doc.title}
            </span>
            <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
              {childCount}
            </span>
          </button>
        ) : (
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
        )}

        {/* Actions */}
        <div className={`flex shrink-0 items-center gap-1 transition-opacity ${isDragging ? "opacity-0" : readOnly ? "opacity-0 group-hover:opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
          {!isFolder && doc.url && (
            <a href={doc.url} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </a>
          )}
          {!readOnly && (
            <>
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
            </>
          )}
        </div>
      </div>
    )
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
                {readOnly ? "Player's Recruiting Page" : "Your Recruiting Page"}
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
          {!readOnly && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => { setShowAddFolderForm(true); setShowAddForm(false) }}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add Folder
              </Button>
              <Button
                size="sm"
                onClick={() => { setShowAddForm(true); setShowAddFolderForm(false) }}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add Item
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          {/* Add folder form */}
          {showAddFolderForm && (
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50/30 p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-blue-600">New Folder</p>
              <input
                type="text"
                value={addFolderTitle}
                onChange={(e) => setAddFolderTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddFolder() }}
                placeholder="Folder name (e.g., Film)"
                autoFocus
                className="mb-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-bold uppercase text-foreground placeholder:normal-case placeholder:font-normal placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-400/40"
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleAddFolder}
                  disabled={savingFolder || !addFolderTitle.trim()}
                  className="bg-blue-600 text-white hover:bg-blue-700"
                >
                  {savingFolder ? "Creating..." : "Create Folder"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setShowAddFolderForm(false); setAddFolderTitle("") }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Add item form */}
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

              {/* Folder selector */}
              {folders.length > 0 && (
                <div className="mb-2">
                  <select
                    value={addFolderId || ""}
                    onChange={(e) => setAddFolderId(e.target.value || null)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="">No Folder (top level)</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>{f.title}</option>
                    ))}
                  </select>
                </div>
              )}

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
              onPointerMove={readOnly ? undefined : handlePointerMove}
              onPointerUp={readOnly ? undefined : handlePointerUp}
            >
              {/* During drag, render from frozen snapshot; otherwise normal renderList */}
              {(dragInfo ? dragInfo.renderSnapshot : renderList).map((item, index) =>
                renderDocRow(item.doc, index, item.isChild)
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
