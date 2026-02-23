import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large. Maximum size is 10MB." }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({
        error: "File type not allowed. Accepted: PDF, JPEG, PNG, WEBP, DOC, DOCX",
      }, { status: 400 })
    }

    // Use admin client to ensure bucket exists and upload
    const admin = createAdminClient()

    // Create bucket if it doesn't exist (idempotent)
    await admin.storage.createBucket("athlete-documents", {
      public: true,
      fileSizeLimit: MAX_FILE_SIZE,
      allowedMimeTypes: ALLOWED_TYPES,
    })

    // Generate unique file path
    const ext = file.name.split(".").pop() || "bin"
    const timestamp = Date.now()
    const filePath = `${user.id}/${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`

    // Upload to Supabase Storage
    const arrayBuffer = await file.arrayBuffer()
    const { data: uploadData, error: uploadError } = await admin.storage
      .from("athlete-documents")
      .upload(filePath, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error("[Documents Upload] Storage error:", uploadError)
      return NextResponse.json({ error: "Failed to upload file" }, { status: 500 })
    }

    // Get public URL
    const { data: urlData } = admin.storage
      .from("athlete-documents")
      .getPublicUrl(filePath)

    return NextResponse.json({
      filePath,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      publicUrl: urlData.publicUrl,
    })
  } catch (error) {
    console.error("[Documents Upload] Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
