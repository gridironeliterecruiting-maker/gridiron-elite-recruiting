#!/usr/bin/env node
/**
 * Bulk-populate ESPN logos and espn_id for all programs in Supabase.
 * 
 * Strategy:
 * 1. Fetch ALL ESPN college football teams (FBS, FCS, DII, DIII)
 * 2. Match by school name (fuzzy)
 * 3. Update logo_url and espn_id in Supabase
 */

const SUPABASE_URL = "https://ufmzldfkdpjeyvjfpoid.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmbXpsZGZrZHBqZXl2amZwb2lkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDY5NzI0NiwiZXhwIjoyMDg2MjczMjQ2fQ.jmdZDiLCZRd2glLEeEaU2udVsAbz11R7uf5HLkVYUCM";

const ESPN_BASE = "http://site.api.espn.com/apis/site/v2/sports/football/college-football/teams";

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=minimal",
};

function normalize(name) {
  return name
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/\s*(university|college|institute|of technology)\s*/gi, " ")
    .replace(/\s*(of|at|the)\s*/gi, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchAllESPNTeams() {
  const teams = [];
  // ESPN paginates, fetch pages of 100
  for (let page = 1; page <= 5; page++) {
    const url = `${ESPN_BASE}?limit=500&page=${page}`;
    console.log(`Fetching ESPN page ${page}...`);
    const res = await fetch(url);
    const data = await res.json();
    const batch = data.sports?.[0]?.leagues?.[0]?.teams || [];
    if (batch.length === 0) break;
    
    for (const team of batch) {
      const t = team.team || team;
      teams.push({
        id: parseInt(t.id),
        name: t.displayName || t.name,
        shortName: t.shortDisplayName || t.abbreviation,
        location: t.location,
        logo: t.logos?.[0]?.href || `https://a.espncdn.com/i/teamlogos/ncaa/500/${t.id}.png`,
      });
    }
    if (batch.length < 500) break;
  }
  
  console.log(`Fetched ${teams.length} ESPN teams`);
  return teams;
}

async function fetchAllPrograms() {
  const programs = [];
  let offset = 0;
  const limit = 500;
  
  while (true) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/programs?select=id,school_name,logo_url,espn_id&order=school_name&offset=${offset}&limit=${limit}`,
      { headers }
    );
    const batch = await res.json();
    programs.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }
  
  console.log(`Fetched ${programs.length} programs from Supabase`);
  return programs;
}

function matchTeam(programName, espnTeams, espnIndex) {
  const normProg = normalize(programName);
  
  // Exact normalized match
  if (espnIndex.has(normProg)) return espnIndex.get(normProg);
  
  // Try matching just the program name against ESPN location or name
  for (const team of espnTeams) {
    const normName = normalize(team.name);
    const normLoc = normalize(team.location || "");
    
    // Program name contains ESPN name or vice versa
    if (normProg === normName || normProg === normLoc) return team;
    if (normProg.includes(normName) && normName.length > 3) return team;
    if (normName.includes(normProg) && normProg.length > 3) return team;
    // Location match
    if (normProg.includes(normLoc) && normLoc.length > 3) return team;
    if (normLoc.includes(normProg) && normProg.length > 3) return team;
  }
  
  return null;
}

async function main() {
  const [espnTeams, programs] = await Promise.all([fetchAllESPNTeams(), fetchAllPrograms()]);
  
  // Build index
  const espnIndex = new Map();
  for (const team of espnTeams) {
    espnIndex.set(normalize(team.name), team);
    if (team.location) espnIndex.set(normalize(team.location), team);
  }
  
  let matched = 0;
  let alreadyHad = 0;
  let noMatch = 0;
  const updates = [];
  const unmatched = [];
  
  for (const prog of programs) {
    if (prog.logo_url && prog.espn_id) {
      alreadyHad++;
      continue;
    }
    
    const team = matchTeam(prog.school_name, espnTeams, espnIndex);
    if (team) {
      updates.push({
        id: prog.id,
        school_name: prog.school_name,
        espn_id: team.id,
        logo_url: `https://a.espncdn.com/i/teamlogos/ncaa/500/${team.id}.png`,
        espn_name: team.name,
      });
      matched++;
    } else {
      unmatched.push(prog.school_name);
      noMatch++;
    }
  }
  
  console.log(`\nMatched: ${matched} | Already had: ${alreadyHad} | No match: ${noMatch}`);
  
  // Batch update in groups of 50
  let updated = 0;
  for (let i = 0; i < updates.length; i += 50) {
    const batch = updates.slice(i, i + 50);
    const promises = batch.map((u) =>
      fetch(`${SUPABASE_URL}/rest/v1/programs?id=eq.${u.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ espn_id: u.espn_id, logo_url: u.logo_url }),
      })
    );
    const results = await Promise.all(promises);
    const ok = results.filter((r) => r.ok).length;
    updated += ok;
    console.log(`Updated batch ${Math.floor(i / 50) + 1}: ${ok}/${batch.length} OK`);
  }
  
  console.log(`\nTotal updated: ${updated}`);
  
  if (unmatched.length > 0 && unmatched.length <= 200) {
    console.log(`\nUnmatched programs (${unmatched.length}):`);
    for (const name of unmatched.slice(0, 50)) {
      console.log(`  - ${name}`);
    }
    if (unmatched.length > 50) console.log(`  ... and ${unmatched.length - 50} more`);
  }
}

main().catch(console.error);
