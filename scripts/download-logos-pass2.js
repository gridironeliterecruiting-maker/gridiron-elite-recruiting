#!/usr/bin/env node
/**
 * Second-pass logo download: scan ALL ESPN IDs (1–3145 + high outliers)
 * to find teams missing from the paginated API, then match & download.
 *
 * The first-pass script only uses ESPN's paginated teams API (754 teams).
 * Many DIII/NAIA/JUCO schools exist on ESPN but aren't in that API.
 * This script individually looks up each ESPN ID to build a complete list.
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: 'postgresql://postgres.ufmzldfkdpjeyvjfpoid:MScp1BrdQZF8QBHp@aws-0-us-west-2.pooler.supabase.com:5432/postgres'
});

const ESPN_TEAM_API = "http://site.api.espn.com/apis/site/v2/sports/football/college-football/teams";
const LOGO_BASE = "https://a.espncdn.com/i/teamlogos/ncaa/500";
const OUTPUT_DIR = path.join(__dirname, '..', 'app', 'public', 'logos');

function normalize(s) {
  return s.toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fetch a single ESPN team by ID, returns { id, displayName, location } or null
async function fetchTeam(id) {
  try {
    const r = await fetch(`${ESPN_TEAM_API}/${id}`);
    if (!r.ok) return null;
    const d = await r.json();
    if (!d.team) return null;
    return {
      id: parseInt(d.team.id),
      displayName: d.team.displayName || d.team.name,
      location: d.team.location,
    };
  } catch {
    return null;
  }
}

// Fetch teams in concurrent batches
async function scanESPNIds(ids, concurrency = 20) {
  const teams = [];
  for (let i = 0; i < ids.length; i += concurrency) {
    const batch = ids.slice(i, i + concurrency);
    const results = await Promise.all(batch.map(fetchTeam));
    for (const t of results) {
      if (t) teams.push(t);
    }
    if ((i + concurrency) % 200 === 0 || i + concurrency >= ids.length) {
      process.stdout.write(`  Scanned ${Math.min(i + concurrency, ids.length)}/${ids.length} IDs (${teams.length} teams found)\r`);
    }
  }
  console.log();
  return teams;
}

async function downloadLogo(espnId, destPath) {
  const url = `${LOGO_BASE}/${espnId}.png`;
  const res = await fetch(url);
  if (!res.ok) return false;
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buffer);
  return true;
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Get unmatched programs (no espn_id)
  const client = await pool.connect();
  try {
    const { rows: unmatched } = await client.query(
      "SELECT id, school_name FROM programs WHERE espn_id IS NULL ORDER BY school_name"
    );
    console.log(`${unmatched.length} programs without ESPN match\n`);

    if (unmatched.length === 0) {
      console.log('Nothing to do!');
      return;
    }

    // Get already-used ESPN IDs to avoid duplicates
    const { rows: usedRows } = await client.query(
      "SELECT espn_id FROM programs WHERE espn_id IS NOT NULL"
    );
    const usedEspnIds = new Set(usedRows.map(r => r.espn_id));

    // Build the full list of IDs to scan: 1–3145 + known high outliers
    const idsToScan = [];
    for (let id = 1; id <= 3145; id++) idsToScan.push(id);
    // High outlier ranges (sparse — check individual ranges)
    for (let id = 95; id <= 95; id++) idsToScan.push(id); // already in 1-3145
    for (let id = 100000; id <= 102000; id++) idsToScan.push(id);
    for (let id = 125000; id <= 130000; id++) idsToScan.push(id);

    // Remove already-used IDs from scan (no need to look them up)
    const filteredIds = idsToScan.filter(id => !usedEspnIds.has(id));
    console.log(`Scanning ${filteredIds.length} ESPN IDs (skipping ${idsToScan.length - filteredIds.length} already matched)...`);

    const espnTeams = await scanESPNIds(filteredIds, 20);
    console.log(`Found ${espnTeams.length} additional ESPN teams\n`);

    // Build lookup maps
    const byExactName = new Map();
    const byNormalized = new Map();
    const byLocation = new Map();
    for (const t of espnTeams) {
      if (usedEspnIds.has(t.id)) continue; // skip already-matched
      byExactName.set(t.displayName.toLowerCase(), t);
      byNormalized.set(normalize(t.displayName), t);
      if (t.location) byLocation.set(t.location.toLowerCase(), t);
    }

    let matched = 0, downloaded = 0, failed = 0, noMatch = 0;

    for (const prog of unmatched) {
      let espnId = null;

      // 1. Exact displayName match
      const t1 = byExactName.get(prog.school_name.toLowerCase());
      if (t1) espnId = t1.id;

      // 2. Normalized match
      if (!espnId) {
        const t2 = byNormalized.get(normalize(prog.school_name));
        if (t2) espnId = t2.id;
      }

      // 3. Direct location match (school_name === ESPN location)
      //    e.g. "Central College" matches ESPN location "Central College"
      if (!espnId) {
        const t3 = byLocation.get(prog.school_name.toLowerCase());
        if (t3) espnId = t3.id;
      }

      // 4. "University of X" → location match
      if (!espnId) {
        const m = prog.school_name.match(/^University of (.+)$/i);
        if (m) {
          const t4 = byLocation.get(m[1].toLowerCase());
          if (t4 && normalize(t4.location || '') === normalize(m[1])) {
            espnId = t4.id;
          }
        }
      }

      // 5. Try location match for "X University" / "X College" / "X State"
      if (!espnId) {
        const m2 = prog.school_name.match(/^(.+?)\s+(?:University|College|State University|State)$/i);
        if (m2) {
          const loc = m2[1].toLowerCase();
          const t5 = byLocation.get(loc);
          if (t5 && normalize(t5.location || '') === normalize(m2[1])) {
            espnId = t5.id;
          }
        }
      }

      if (!espnId) {
        noMatch++;
        continue;
      }

      // Check for duplicate ESPN ID
      if (usedEspnIds.has(espnId)) {
        continue;
      }
      usedEspnIds.add(espnId);

      matched++;
      const destPath = path.join(OUTPUT_DIR, `${prog.id}.png`);
      const localUrl = `/logos/${prog.id}.png`;

      if (fs.existsSync(destPath)) {
        // Already have the file, just update DB
        await client.query(
          "UPDATE programs SET espn_id = $1, logo_url = $2 WHERE id = $3",
          [espnId, localUrl, prog.id]
        );
        continue;
      }

      try {
        const ok = await downloadLogo(espnId, destPath);
        if (ok) {
          await client.query(
            "UPDATE programs SET espn_id = $1, logo_url = $2 WHERE id = $3",
            [espnId, localUrl, prog.id]
          );
          downloaded++;
          if (downloaded % 20 === 0) console.log(`  Downloaded ${downloaded} new logos...`);
        } else {
          failed++;
        }
      } catch (err) {
        console.log(`  Error: ${prog.school_name} — ${err.message}`);
        failed++;
      }

      await sleep(100);
    }

    console.log('\n=== Pass 2 Summary ===');
    console.log(`Newly matched:   ${matched}`);
    console.log(`Downloaded:      ${downloaded}`);
    console.log(`Failed (404):    ${failed}`);
    console.log(`Still unmatched: ${noMatch}`);

    const { rows: [c] } = await client.query("SELECT count(*) FROM programs WHERE logo_url LIKE '/logos/%'");
    console.log(`\nTotal programs with local logos: ${c.count}`);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
