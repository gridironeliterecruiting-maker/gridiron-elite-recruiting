import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  
  // Use service role for reliable data access (auth checked by middleware)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    }
  )

  const q = req.nextUrl.searchParams.get("q") || ""
  const division = req.nextUrl.searchParams.get("division") || ""
  const offset = parseInt(req.nextUrl.searchParams.get("offset") || "0")
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50")

  let query = supabase
    .from("coaches")
    .select("id, program_id, first_name, last_name, title, email, phone, twitter_handle, twitter_dm_open, programs(id, school_name, division, conference, logo_url)", { count: "exact" })
    .eq("is_active", true)
    .order("last_name")
    .range(offset, offset + limit - 1)

  if (division && division !== "ALL") {
    query = query.eq("programs.division", division)
  }

  if (q) {
    query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,title.ilike.%${q}%`)
  }

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ coaches: data || [], total: count || 0 })
}
