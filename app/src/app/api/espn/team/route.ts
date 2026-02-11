import { NextRequest, NextResponse } from "next/server"

const ESPN_BASE = "http://site.api.espn.com/apis"

export async function GET(req: NextRequest) {
  const espnId = req.nextUrl.searchParams.get("id")
  if (!espnId) {
    return NextResponse.json({ error: "Missing id param" }, { status: 400 })
  }

  try {
    // Fetch team info, news, and standings in parallel
    const [teamRes, newsRes, standingsRes] = await Promise.all([
      fetch(`${ESPN_BASE}/site/v2/sports/football/college-football/teams/${espnId}`, { next: { revalidate: 3600 } }),
      fetch(`${ESPN_BASE}/site/v2/sports/football/college-football/news?team=${espnId}&limit=3`, { next: { revalidate: 3600 } }),
      fetch(`${ESPN_BASE}/v2/sports/football/college-football/standings?season=2025&group=80`, { next: { revalidate: 3600 } }),
    ])

    const teamData = await teamRes.json()
    const newsData = await newsRes.json()
    const standingsData = await standingsRes.json()

    const team = teamData.team || {}

    // Extract links (deduplicated)
    const linkMap = new Map<string, string>()
    for (const link of team.links || []) {
      if (link.text && link.href && !linkMap.has(link.text)) {
        linkMap.set(link.text, link.href)
      }
    }
    const links = Array.from(linkMap.entries())
      .filter(([text]) => ["Clubhouse", "Roster", "Statistics", "Schedule"].includes(text))
      .map(([text, href]) => ({ text, href }))

    // Extract news
    const news = (newsData.articles || []).map((a: any) => ({
      headline: a.headline,
      description: a.description,
      published: a.published,
      link: a.links?.web?.href,
      image: a.images?.[0]?.url,
    }))

    // Find team in standings — try current season first, fall back to previous
    let record: Record<string, string> = {}
    const allEntries = standingsData.children?.flatMap((c: any) => c.standings?.entries || []) || []
    let teamStanding = allEntries.find((e: any) => e.team?.id === espnId)

    if (teamStanding) {
      for (const s of teamStanding.stats || []) {
        record[s.name] = s.displayValue
      }
    }

    // If overall record is missing or "0-0", try previous season
    if (!record.overall || record.overall === "0-0") {
      try {
        const prevRes = await fetch(`${ESPN_BASE}/v2/sports/football/college-football/standings?season=2024&group=80`, { next: { revalidate: 86400 } })
        const prevData = await prevRes.json()
        const prevEntries = prevData.children?.flatMap((c: any) => c.standings?.entries || []) || []
        const prevStanding = prevEntries.find((e: any) => e.team?.id === espnId)
        if (prevStanding) {
          record = {}
          for (const s of prevStanding.stats || []) {
            record[s.name] = s.displayValue
          }
          record._season = "2024"
        }
      } catch {
        // ignore fallback errors
      }
    }

    return NextResponse.json({
      color: team.color,
      alternateColor: team.alternateColor,
      standingSummary: team.standingSummary,
      links,
      news,
      record: {
        overall: record.overall,
        home: record.Home,
        away: record.Away,
        conference: record["vs. Conf."],
        streak: record.streak,
        apTop25: record["vs AP Top 25"],
        season: record._season || "2025",
      },
    })
  } catch (err) {
    console.error("ESPN API error:", err)
    return NextResponse.json({ error: "Failed to fetch ESPN data" }, { status: 500 })
  }
}
