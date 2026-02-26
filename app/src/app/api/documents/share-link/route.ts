import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET — get or generate the athlete's share slug (or a player's for coaches)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const playerId = searchParams.get("playerId")

    // Coach fetching a player's share slug
    if (playerId) {
      const { data: link } = await supabase
        .from("coach_players")
        .select("id")
        .eq("coach_id", user.id)
        .eq("player_id", playerId)
        .single()

      if (!link) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 })
      }

      const admin = createAdminClient()
      const { data: playerProfile } = await admin
        .from("profiles")
        .select("share_slug")
        .eq("id", playerId)
        .single()

      return NextResponse.json({ slug: playerProfile?.share_slug || null })
    }

    // Check if athlete already has a share slug
    const { data: profile } = await supabase
      .from("profiles")
      .select("share_slug, first_name, last_name")
      .eq("id", user.id)
      .single()

    if (profile?.share_slug) {
      return NextResponse.json({ slug: profile.share_slug })
    }

    // Generate a slug from name + random suffix
    const firstName = (profile?.first_name || "athlete").toLowerCase().replace(/[^a-z0-9]/g, "")
    const lastName = (profile?.last_name || "").toLowerCase().replace(/[^a-z0-9]/g, "")
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    const slug = lastName ? `${firstName}-${lastName}-${randomSuffix}` : `${firstName}-${randomSuffix}`

    // Save the slug
    const { error } = await supabase
      .from("profiles")
      .update({ share_slug: slug })
      .eq("id", user.id)

    if (error) {
      console.error("[Share Link] Failed to save slug:", error)
      return NextResponse.json({ error: "Failed to generate share link" }, { status: 500 })
    }

    return NextResponse.json({ slug })
  } catch (error) {
    console.error("[Share Link] Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
