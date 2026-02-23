import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET — list athlete's documents
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: documents, error } = await supabase
      .from("athlete_documents")
      .select("*")
      .eq("athlete_id", user.id)
      .order("display_order", { ascending: true })

    if (error) {
      console.error("[Documents] List error:", error)
      return NextResponse.json({ error: "Failed to load documents" }, { status: 500 })
    }

    return NextResponse.json({ documents: documents || [] })
  } catch (error) {
    console.error("[Documents] Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST — create a new document (link or metadata for uploaded file)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { title, description, type, url, filePath, fileName, fileSize, fileType, folderId } = body

    if (!title || !type) {
      return NextResponse.json({ error: "Title and type are required" }, { status: 400 })
    }

    // Get the next display_order
    const { data: existing } = await supabase
      .from("athlete_documents")
      .select("display_order")
      .eq("athlete_id", user.id)
      .order("display_order", { ascending: false })
      .limit(1)

    const nextOrder = existing && existing.length > 0 ? existing[0].display_order + 1 : 0

    const { data: doc, error } = await supabase
      .from("athlete_documents")
      .insert({
        athlete_id: user.id,
        title,
        description: description || null,
        type,
        url: url || null,
        file_path: filePath || null,
        file_name: fileName || null,
        file_size: fileSize || null,
        file_type: fileType || null,
        display_order: nextOrder,
        folder_id: type === "folder" ? null : (folderId || null),
      })
      .select()
      .single()

    if (error) {
      console.error("[Documents] Create error:", error)
      return NextResponse.json({ error: "Failed to create document" }, { status: 500 })
    }

    return NextResponse.json({ document: doc })
  } catch (error) {
    console.error("[Documents] Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH — update a document
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { id, title, description, url, isVisible, displayOrder, folderId } = body

    if (!id) {
      return NextResponse.json({ error: "Document ID is required" }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    if (title !== undefined) updates.title = title
    if (description !== undefined) updates.description = description
    if (url !== undefined) updates.url = url
    if (isVisible !== undefined) updates.is_visible = isVisible
    if (displayOrder !== undefined) updates.display_order = displayOrder
    if (folderId !== undefined) updates.folder_id = folderId

    const { data: doc, error } = await supabase
      .from("athlete_documents")
      .update(updates)
      .eq("id", id)
      .eq("athlete_id", user.id)
      .select()
      .single()

    if (error) {
      console.error("[Documents] Update error:", error)
      return NextResponse.json({ error: "Failed to update document" }, { status: 500 })
    }

    return NextResponse.json({ document: doc })
  } catch (error) {
    console.error("[Documents] Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE — remove a document
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Document ID is required" }, { status: 400 })
    }

    // Get the document first to check for file cleanup and folder handling
    const { data: doc } = await supabase
      .from("athlete_documents")
      .select("file_path, type")
      .eq("id", id)
      .eq("athlete_id", user.id)
      .single()

    if (doc?.file_path) {
      // Delete file from storage if it exists
      await supabase.storage.from("athlete-documents").remove([doc.file_path])
    }

    // If deleting a folder, un-nest its children first (move to top-level)
    if (doc?.type === "folder") {
      await supabase
        .from("athlete_documents")
        .update({ folder_id: null })
        .eq("folder_id", id)
        .eq("athlete_id", user.id)
    }

    const { error } = await supabase
      .from("athlete_documents")
      .delete()
      .eq("id", id)
      .eq("athlete_id", user.id)

    if (error) {
      console.error("[Documents] Delete error:", error)
      return NextResponse.json({ error: "Failed to delete document" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Documents] Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
