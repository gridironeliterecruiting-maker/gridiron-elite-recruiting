"use client"

import { useState } from "react"
import {
  Video,
  FileText,
  Link2,
  Folder,
  ChevronRight,
  ExternalLink,
  Download,
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
  display_order: number
  is_visible: boolean
  folder_id: string | null
}

interface RecruitDocumentsProps {
  documents: Document[]
  supabaseUrl: string
}

export function RecruitDocuments({ documents, supabaseUrl }: RecruitDocumentsProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    // Start with all folders expanded
    const folderIds = new Set<string>()
    for (const doc of documents) {
      if (doc.type === "folder") folderIds.add(doc.id)
    }
    return folderIds
  })

  // Build folder contents map
  const folderContents = new Map<string, Document[]>()
  for (const doc of documents) {
    if (doc.folder_id && doc.type !== "folder") {
      const list = folderContents.get(doc.folder_id) || []
      list.push(doc)
      folderContents.set(doc.folder_id, list)
    }
  }

  // Top-level items in display_order (folders + standalone items)
  const topLevel = documents
    .filter((d) => d.folder_id === null)
    .sort((a, b) => a.display_order - b.display_order)

  // Only show folders that have visible items, and non-folder items
  const hasContent = topLevel.some((d) => {
    if (d.type === "folder") {
      const children = folderContents.get(d.id)
      return children && children.length > 0
    }
    return true
  })

  if (!hasContent) {
    return (
      <div className="rounded-xl border border-border bg-white p-12 text-center shadow-sm">
        <p className="text-sm text-[hsl(222,47%,11%)]/60">
          No documents have been shared yet.
        </p>
      </div>
    )
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

  function getFileUrl(doc: Document) {
    if (doc.url) return doc.url
    if (doc.file_path) {
      return `${supabaseUrl}/storage/v1/object/public/athlete-documents/${doc.file_path}`
    }
    return "#"
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

  function renderItemRow(doc: Document, indented: boolean) {
    const href = getFileUrl(doc)

    return (
      <a
        key={doc.id}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`group flex items-center gap-3 rounded-lg border border-border bg-white px-3 py-2 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 ${
          indented ? "ml-8" : ""
        }`}
      >
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${typeColor(doc.type)}`}>
          {typeIcon(doc.type)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[hsl(222,47%,11%)]">{doc.title}</p>
          {doc.description && (
            <p className="mt-0.5 text-xs text-[hsl(222,47%,11%)]/60">{doc.description}</p>
          )}
          {doc.type === "file" && doc.file_name && (
            <p className="mt-0.5 text-[10px] text-[hsl(222,47%,11%)]/40">{doc.file_name}</p>
          )}
        </div>
        {doc.type === "file" ? (
          <Download className="h-4 w-4 shrink-0 text-[hsl(222,47%,11%)]/20 transition-transform group-hover:translate-y-0.5 group-hover:text-[hsl(224,76%,30%)]" />
        ) : (
          <ExternalLink className="h-4 w-4 shrink-0 text-[hsl(222,47%,11%)]/20 transition-transform group-hover:translate-x-0.5 group-hover:text-[hsl(224,76%,30%)]" />
        )}
      </a>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      {topLevel.map((doc) => {
        // Folder row — skip if empty
        if (doc.type === "folder") {
          const children = folderContents.get(doc.id)
          if (!children || children.length === 0) return null
          const isExpanded = expandedFolders.has(doc.id)

          return (
            <div key={doc.id}>
              <button
                type="button"
                onClick={() => toggleFolder(doc.id)}
                className="flex w-full items-center gap-3 rounded-lg border border-border bg-white px-3 py-2.5 text-left shadow-sm transition-all hover:shadow-md"
              >
                {/* Chevron */}
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600 transition-colors hover:bg-blue-100">
                  <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
                </div>
                {/* Folder icon + name */}
                <Folder className="h-4 w-4 shrink-0 text-blue-600" />
                <span className="text-sm font-bold uppercase tracking-wide text-[hsl(222,47%,11%)]">
                  {doc.title}
                </span>
                <span className="shrink-0 rounded-full bg-[hsl(220,14%,96%)] px-2.5 py-0.5 text-xs font-semibold text-[hsl(222,47%,11%)]/50">
                  {children.length}
                </span>
              </button>
              {/* Expanded children */}
              {isExpanded && (
                <div className="mt-1.5 flex flex-col gap-1.5">
                  {children.map((child) => renderItemRow(child, true))}
                </div>
              )}
            </div>
          )
        }

        // Non-folder item at top level
        return renderItemRow(doc, false)
      })}
    </div>
  )
}
