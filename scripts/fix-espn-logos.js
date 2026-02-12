#!/usr/bin/env node
/**
 * Strict ESPN logo matching — only assign when we're confident it's the right team.
 * Uses ESPN displayName for exact matching.
 */

const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.ufmzldfkdpjeyvjfpoid:MScp1BrdQZF8QBHp@aws-0-us-west-2.pooler.supabase.com:5432/postgres'
});

const ESPN_BASE = "http://site.api.espn.com/apis/site/v2/sports/football/college-football/teams";

function normalize(s) {
  return s.toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchAllESPNTeams() {
  const teams = [];
  for (let page = 1; page <= 5; page++) {
    const res = await fetch(`${ESPN_BASE}?limit=500&page=${page}`);
    const data = await res.json();
    const batch = data.sports?.[0]?.leagues?.[0]?.teams || [];
    if (batch.length === 0) break;
    for (const team of batch) {
      const t = team.team || team;
      teams.push({
        id: parseInt(t.id),
        displayName: t.displayName || t.name,
        shortName: t.shortDisplayName,
        location: t.location,
        nickname: t.nickname,
        abbreviation: t.abbreviation,
      });
    }
    if (batch.length < 500) break;
  }
  console.log(`Fetched ${teams.length} ESPN teams`);
  return teams;
}

async function main() {
  const espnTeams = await fetchAllESPNTeams();
  const client = await pool.connect();
  
  try {
    // Get programs needing ESPN data
    const { rows: programs } = await client.query(
      "SELECT id, school_name FROM programs WHERE espn_id IS NULL ORDER BY school_name"
    );
    console.log(`${programs.length} programs need ESPN matching`);

    // Build multiple lookup maps for ESPN teams
    const byExactName = new Map(); // displayName → team
    const byLocation = new Map(); // location → team
    const byNormalized = new Map(); // normalized displayName → team
    
    for (const t of espnTeams) {
      byExactName.set(t.displayName.toLowerCase(), t);
      byNormalized.set(normalize(t.displayName), t);
      if (t.location) byLocation.set(t.location.toLowerCase(), t);
    }

    // Build specific manual mappings for tricky cases
    const manual = {
      'University of Alabama': 333,
      'University of Iowa': 2294,
      'Iowa State University': 66,
      'University of Northern Iowa': 2460,
      'Ohio State University': 194,
      'University of Nebraska': 158,
      'University of Minnesota': 135,
      'South Dakota State University': 2571,
      'University of Michigan': 130,
      'University of Georgia': 61,
      'University of Florida': 57,
      'University of Texas - Austin': 251,
      'Louisiana State University (LSU)': 99,
      'University of Southern California': 30,
      'University of Oregon': 2483,
      'University of Notre Dame': 87,
      'Clemson University': 228,
      'Penn State University': 213,
      'University of Tennessee': 2633,
      'University of Wisconsin': 275,
      'University of Oklahoma': 201,
      'Auburn University': 2,
      'Texas A&M University': 245,
      'University of Mississippi': 145,
      'University of Kentucky': 96,
      'University of South Carolina': 2579,
      'University of Missouri': 142,
      'Mississippi State University': 344,
      'Vanderbilt University': 238,
      'University of Arkansas': 8,
      'Purdue University': 2509,
      'University of Illinois': 356,
      'University of Maryland': 120,
      'Rutgers University': 164,
      'Indiana University': 84,
      'Northwestern University': 77,
      'Michigan State University': 127,
      'University of Colorado - Boulder': 38,
      'University of Arizona': 12,
      'Arizona State University': 9,
      'University of Utah': 254,
      'Oregon State University': 204,
      'Washington State University': 265,
      'University of California - Berkeley': 25,
      'University of California - Los Angeles - UCLA': 26,
      'Stanford University': 24,
      'University of Washington': 264,
      'Baylor University': 239,
      'Texas Christian University': 2628,
      'University of Cincinnati': 2132,
      'University of Houston': 248,
      'Brigham Young University': 252,
      'University of Central Florida': 2116,
      'Kansas State University': 2306,
      'University of Kansas': 2305,
      'West Virginia University': 277,
      'Texas Tech University': 2641,
      'Oklahoma State University': 197,
      'Iowa Western Community College': null,
      'Iowa Central Community College': null,
    };

    let matched = 0, skipped = 0;
    
    for (const prog of programs) {
      let espnId = null;
      
      // 1. Check manual mapping
      if (prog.school_name in manual) {
        espnId = manual[prog.school_name];
        if (espnId === null) { skipped++; continue; }
      }
      
      // 2. Exact displayName match
      if (!espnId) {
        const t = byExactName.get(prog.school_name.toLowerCase());
        if (t) espnId = t.id;
      }
      
      // 3. Normalized match (strip punctuation, etc)
      if (!espnId) {
        const t = byNormalized.get(normalize(prog.school_name));
        if (t) espnId = t.id;
      }
      
      // 4. Try "University of X" → ESPN might have "X Mascots"
      // Only match if the ESPN team location matches our school name pattern
      if (!espnId) {
        const match = prog.school_name.match(/^University of (.+)$/i);
        if (match) {
          const loc = match[1].toLowerCase();
          const t = byLocation.get(loc);
          // Verify it's not a substring match (e.g., "Mary" matching "Maryland")
          if (t && normalize(t.location || '') === normalize(match[1])) {
            espnId = t.id;
          }
        }
      }
      
      if (espnId) {
        // Verify this ESPN ID isn't already used by another program
        const { rows } = await client.query(
          "SELECT id FROM programs WHERE espn_id = $1 AND id != $2", [espnId, prog.id]
        );
        if (rows.length > 0) {
          console.log(`  SKIP ${prog.school_name} → ESPN ${espnId} (already used)`);
          skipped++;
          continue;
        }
        
        await client.query(
          "UPDATE programs SET espn_id = $1, logo_url = $2 WHERE id = $3",
          [espnId, `https://a.espncdn.com/i/teamlogos/ncaa/500/${espnId}.png`, prog.id]
        );
        matched++;
      } else {
        skipped++;
      }
    }
    
    console.log(`\nMatched: ${matched} | Skipped: ${skipped}`);
    
    // Final count
    const { rows: [c] } = await client.query("SELECT count(*) FROM programs WHERE espn_id IS NOT NULL");
    console.log(`Total programs with ESPN logos: ${c.count}`);
    
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
