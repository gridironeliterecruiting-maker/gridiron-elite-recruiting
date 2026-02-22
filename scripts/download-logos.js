#!/usr/bin/env node
/**
 * Download school logos locally and update DB to use local paths.
 *
 * For each program:
 *  1. If it has an espn_id, use it directly
 *  2. If not, try to match via name/location against ESPN API
 *  3. Download PNG to app/public/logos/{program_id}.png
 *  4. Update DB: logo_url = '/logos/{program_id}.png', set espn_id if newly matched
 *
 * Re-runnable: skips files that already exist on disk.
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: 'postgresql://postgres.ufmzldfkdpjeyvjfpoid:MScp1BrdQZF8QBHp@aws-0-us-west-2.pooler.supabase.com:5432/postgres'
});

const ESPN_API = "http://site.api.espn.com/apis/site/v2/sports/football/college-football/teams";
const LOGO_BASE = "https://a.espncdn.com/i/teamlogos/ncaa/500";
const OUTPUT_DIR = path.join(__dirname, '..', 'app', 'public', 'logos');

// ─── Matching helpers (from fix-espn-logos.js) ────────────────

function normalize(s) {
  return s.toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const MANUAL_MAPPINGS = {
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

// ─── ESPN API ────────────────────────────────────────────────

async function fetchAllESPNTeams() {
  const teams = [];
  for (let page = 1; page <= 5; page++) {
    const res = await fetch(`${ESPN_API}?limit=500&page=${page}`);
    const data = await res.json();
    const batch = data.sports?.[0]?.leagues?.[0]?.teams || [];
    if (batch.length === 0) break;
    for (const team of batch) {
      const t = team.team || team;
      teams.push({
        id: parseInt(t.id),
        displayName: t.displayName || t.name,
        location: t.location,
      });
    }
    if (batch.length < 500) break;
  }
  console.log(`Fetched ${teams.length} ESPN teams`);
  return teams;
}

// ─── Download helper ─────────────────────────────────────────

async function downloadLogo(espnId, destPath) {
  const url = `${LOGO_BASE}/${espnId}.png`;
  const res = await fetch(url);
  if (!res.ok) return false;
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buffer);
  return true;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Main ────────────────────────────────────────────────────

async function main() {
  // Ensure output directory exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const espnTeams = await fetchAllESPNTeams();

  // Build lookup maps
  const byExactName = new Map();
  const byNormalized = new Map();
  const byLocation = new Map();
  for (const t of espnTeams) {
    byExactName.set(t.displayName.toLowerCase(), t);
    byNormalized.set(normalize(t.displayName), t);
    if (t.location) byLocation.set(t.location.toLowerCase(), t);
  }

  const client = await pool.connect();
  try {
    const { rows: programs } = await client.query(
      "SELECT id, school_name, espn_id, logo_url FROM programs ORDER BY school_name"
    );
    console.log(`${programs.length} programs in database`);

    let downloaded = 0, skipped = 0, failed = 0, unmatched = 0, alreadyLocal = 0;

    for (const prog of programs) {
      const destPath = path.join(OUTPUT_DIR, `${prog.id}.png`);
      const localUrl = `/logos/${prog.id}.png`;

      // Skip if file already exists on disk
      if (fs.existsSync(destPath)) {
        // Make sure DB points to local path
        if (prog.logo_url !== localUrl) {
          await client.query("UPDATE programs SET logo_url = $1 WHERE id = $2", [localUrl, prog.id]);
        }
        alreadyLocal++;
        continue;
      }

      // Determine ESPN ID
      let espnId = prog.espn_id;

      if (!espnId) {
        // 1. Manual mapping
        if (prog.school_name in MANUAL_MAPPINGS) {
          espnId = MANUAL_MAPPINGS[prog.school_name];
          if (espnId === null) { unmatched++; continue; }
        }

        // 2. Exact displayName match
        if (!espnId) {
          const t = byExactName.get(prog.school_name.toLowerCase());
          if (t) espnId = t.id;
        }

        // 3. Normalized match
        if (!espnId) {
          const t = byNormalized.get(normalize(prog.school_name));
          if (t) espnId = t.id;
        }

        // 4. "University of X" → location match
        if (!espnId) {
          const match = prog.school_name.match(/^University of (.+)$/i);
          if (match) {
            const loc = match[1].toLowerCase();
            const t = byLocation.get(loc);
            if (t && normalize(t.location || '') === normalize(match[1])) {
              espnId = t.id;
            }
          }
        }
      }

      if (!espnId) {
        unmatched++;
        continue;
      }

      // Download logo
      try {
        const ok = await downloadLogo(espnId, destPath);
        if (ok) {
          // Update DB: set local logo_url and espn_id if not already set
          if (prog.espn_id) {
            await client.query("UPDATE programs SET logo_url = $1 WHERE id = $2", [localUrl, prog.id]);
          } else {
            await client.query(
              "UPDATE programs SET logo_url = $1, espn_id = $2 WHERE id = $3",
              [localUrl, espnId, prog.id]
            );
          }
          downloaded++;
          if (downloaded % 50 === 0) console.log(`  Downloaded ${downloaded} logos...`);
        } else {
          console.log(`  404: ${prog.school_name} (ESPN ${espnId})`);
          failed++;
        }
      } catch (err) {
        console.log(`  Error: ${prog.school_name} — ${err.message}`);
        failed++;
      }

      // Rate limit
      await sleep(100);
    }

    console.log('\n=== Summary ===');
    console.log(`Downloaded:     ${downloaded}`);
    console.log(`Already local:  ${alreadyLocal}`);
    console.log(`Failed (404):   ${failed}`);
    console.log(`Unmatched:      ${unmatched}`);
    console.log(`Skipped (null): ${skipped}`);

    const { rows: [c] } = await client.query("SELECT count(*) FROM programs WHERE logo_url LIKE '/logos/%'");
    console.log(`\nPrograms with local logos: ${c.count}`);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
