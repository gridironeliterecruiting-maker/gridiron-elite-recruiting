#!/usr/bin/env node
/**
 * Fix DII + DIII logo gaps with manual ESPN ID mappings.
 * IDs found via https://www.espn.com/college-football/team/_/id/{id}
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: 'postgresql://postgres.ufmzldfkdpjeyvjfpoid:MScp1BrdQZF8QBHp@aws-0-us-west-2.pooler.supabase.com:5432/postgres'
});

const LOGO_BASE = "https://a.espncdn.com/i/teamlogos/ncaa/500";
const OUTPUT_DIR = path.join(__dirname, '..', 'app', 'public', 'logos');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function downloadLogo(espnId, destPath) {
  const res = await fetch(`${LOGO_BASE}/${espnId}.png`);
  if (!res.ok) return false;
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buffer);
  return true;
}

// Step 1: Look up ESPN IDs for all missing programs by searching ESPN API
async function fetchTeam(id) {
  try {
    const r = await fetch(`http://site.api.espn.com/apis/site/v2/sports/football/college-football/teams/${id}`);
    if (!r.ok) return null;
    const d = await r.json();
    if (!d.team) return null;
    return {
      id: parseInt(d.team.id),
      displayName: d.team.displayName,
      location: d.team.location,
    };
  } catch { return null; }
}

// school_name → ESPN ID (manually verified)
const FIXES = {
  // ── DII ──
  'Anderson University - South Carolina': 2863,
  'Augustana University - South Dakota': 2046,
  'California University of Pennsylvania': 2856,
  'Colorado State University - Pueblo': 2857,
  'Davenport University': null, // will search
  'Indiana University of Pennsylvania': 2853,
  'Kentucky State University': 2314,
  'Lincoln University - Missouri': 2852,
  'Lincoln University Pennsylvania': 2849,
  'Michigan Technological University': 2379,
  'Minnesota State University - Mankato': 2382,
  'Minnesota State University - Moorhead': null, // will search
  'Missouri Southern State University': null, // will search
  'Missouri University of Science & Technology': 142, // might be wrong, will search
  'Northwest Missouri State University': 2459,
  'Northwestern Oklahoma State University': null, // will search
  'Northwood University - Michigan': null, // will search
  'Saint Anselm College': null, // will search
  'Shippensburg University of Pennsylvania': 2560,
  'South Dakota School of Mines & Technology': 2561,
  'Southeastern Oklahoma State University': null, // will search
  'Southwest Minnesota State University': null, // will search
  'Texas A&M University - Kingsville': 2616,
  'The University of Virginia\'s College at Wise': null, // will search
  'University of Arkansas at Monticello': 2028,
  'University of Charleston': null, // will search
  'University of Nebraska at Kearney': 2441,
  'University of North Carolina at Pembroke': null, // will search
  'University of Texas - Permian Basin': null, // will search
  'University of West Florida': null, // will search
  'Virginia State University': 2672,
  'Wayne State College': null, // will search
  'Wayne State University': 2688,
  'West Chester University of Pennsylvania': 2694,
  'Western State Colorado University': null, // will search

  // ── DIII ──
  'Alvernia University': null,
  'Anderson University - Indiana': null,
  'Azusa Pacific University': null,
  'Benedictine University': null,
  'Bethany College - West Virginia': null,
  'Bethel University - Minnesota': null,
  'Bridgewater College': null,
  'Bridgewater State University': null,
  'Carroll University': null,
  'Centenary College of Louisiana': null,
  'Concordia University - Chicago': null,
  'Concordia University - Wisconsin': null,
  'Elmhurst University': null,
  'Fairleigh Dickinson University - College at Florham': null,
  'Illinois College': null,
  'Keystone College': null,
  'King\'s College - Pennsylvania': null,
  'Maine Maritime Academy': null,
  'Massachusetts Institute of Technology - MIT': null,
  'Massachusetts Maritime Academy': null,
  'Morrisville State College': null,
  'New England College': null,
  'Pomona-Pitzer Colleges': null,
  'Roanoke College': null,
  'Saint John\'s University - Minnesota': null,
  'Saint Vincent College - Pennsylvania': null,
  'Schreiner University': null,
  'Simpson College': null,
  'SUNY Buffalo State College': null,
  'Trinity College - Connecticut': null,
  'Trinity University - Texas': null,
  'Union College - New York': null,
  'University of Massachusetts - Dartmouth': null,
  'University of Minnesota - Morris': null,
  'University of New England': null,
  'University of Northwestern - St. Paul': null,
  'University of Wisconsin - Eau Claire': null,
  'University of Wisconsin - La Crosse': null,
  'University of Wisconsin - Oshkosh': null,
  'University of Wisconsin - Platteville': null,
  'University of Wisconsin - River Falls': null,
  'University of Wisconsin - Stevens Point': null,
  'University of Wisconsin - Stout': null,
  'University of Wisconsin - Whitewater': null,
  'Washington & Lee University': null,
  'Washington University in St. Louis': null,
  'Wesleyan University': null,
  'Westminster College - Missouri': null,
  'Westminster College - Pennsylvania': null,
  'William Paterson University of New Jersey': null,
};

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // First, scan ESPN to find IDs for all the nulls
  // Build a big lookup from ALL ESPN teams we know about
  console.log('Building ESPN lookup from full ID scan...\n');

  // We already scanned 1-3145, 100000-130000. Let's load ALL teams from those.
  const allTeams = [];
  const batchSize = 50;
  const ranges = [];
  for (let id = 1; id <= 3145; id++) ranges.push(id);
  for (let id = 100000; id <= 102000; id++) ranges.push(id);
  for (let id = 125000; id <= 130000; id++) ranges.push(id);

  // Get already-known ESPN IDs from DB to skip
  const client = await pool.connect();
  const { rows: knownRows } = await client.query("SELECT espn_id FROM programs WHERE espn_id IS NOT NULL");
  const knownIds = new Set(knownRows.map(r => r.espn_id));

  // Only scan IDs not already known
  const idsToScan = ranges.filter(id => !knownIds.has(id));
  console.log(`Scanning ${idsToScan.length} ESPN IDs...`);

  for (let i = 0; i < idsToScan.length; i += batchSize) {
    const batch = idsToScan.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(fetchTeam));
    for (const t of results) {
      if (t) allTeams.push(t);
    }
    if ((i + batchSize) % 500 === 0) {
      process.stdout.write(`  ${Math.min(i + batchSize, idsToScan.length)}/${idsToScan.length} (${allTeams.length} found)\r`);
    }
  }
  console.log(`\nFound ${allTeams.length} ESPN teams to match against\n`);

  // Build lookup maps
  const byLocation = new Map();
  const byNormalized = new Map();
  const byDisplayName = new Map();
  for (const t of allTeams) {
    byDisplayName.set(t.displayName.toLowerCase(), t);
    if (t.location) byLocation.set(t.location.toLowerCase(), t);
    const norm = t.displayName.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    byNormalized.set(norm, t);
    if (t.location) {
      const locNorm = t.location.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
      byNormalized.set(locNorm, t);
    }
  }

  // Try to fill in null IDs
  const missingSchools = Object.entries(FIXES).filter(([_, id]) => id === null);
  console.log(`Attempting to auto-match ${missingSchools.length} schools...\n`);

  for (const [schoolName] of missingSchools) {
    // Try multiple matching strategies
    let match = null;

    // 1. Direct location match
    match = byLocation.get(schoolName.toLowerCase());

    // 2. Strip suffixes like " - South Carolina", " - Minnesota" etc
    if (!match) {
      const stripped = schoolName.replace(/\s*-\s*[A-Za-z\s]+$/, '').trim();
      match = byLocation.get(stripped.toLowerCase()) || byDisplayName.get(stripped.toLowerCase());
    }

    // 3. Try "University of X" pattern
    if (!match) {
      const m = schoolName.match(/^University of (.+?)(?:\s*-\s*.+)?$/i);
      if (m) {
        match = byLocation.get(m[1].toLowerCase());
      }
    }

    // 4. Try normalized
    if (!match) {
      const norm = schoolName.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
      match = byNormalized.get(norm);
    }

    if (match && !knownIds.has(match.id)) {
      FIXES[schoolName] = match.id;
      knownIds.add(match.id);
      console.log(`  AUTO: ${schoolName} → ${match.id} (${match.displayName})`);
    } else {
      console.log(`  SKIP: ${schoolName}`);
    }
  }

  // Now download logos for all non-null fixes
  console.log('\n--- Downloading logos ---\n');
  let fixed = 0, downloaded = 0, failed = 0, notInDb = 0;

  for (const [schoolName, espnId] of Object.entries(FIXES)) {
    if (!espnId) continue;

    const { rows } = await client.query(
      "SELECT id, espn_id, logo_url FROM programs WHERE school_name = $1",
      [schoolName]
    );
    if (rows.length === 0) {
      console.log(`  NOT IN DB: ${schoolName}`);
      notInDb++;
      continue;
    }

    const prog = rows[0];
    const destPath = path.join(OUTPUT_DIR, `${prog.id}.png`);
    const localUrl = `/logos/${prog.id}.png`;

    const needsDownload = !fs.existsSync(destPath) || prog.espn_id !== espnId;
    if (needsDownload) {
      try {
        const ok = await downloadLogo(espnId, destPath);
        if (ok) {
          await client.query(
            "UPDATE programs SET espn_id = $1, logo_url = $2 WHERE id = $3",
            [espnId, localUrl, prog.id]
          );
          downloaded++;
          console.log(`  OK ${schoolName} → ESPN ${espnId}`);
        } else {
          console.log(`  404: ${schoolName} (ESPN ${espnId})`);
          failed++;
        }
      } catch (err) {
        console.log(`  ERR: ${schoolName} — ${err.message}`);
        failed++;
      }
      await sleep(100);
    } else {
      if (prog.logo_url !== localUrl || prog.espn_id !== espnId) {
        await client.query(
          "UPDATE programs SET espn_id = $1, logo_url = $2 WHERE id = $3",
          [espnId, localUrl, prog.id]
        );
      }
      console.log(`  EXISTS: ${schoolName}`);
    }
    fixed++;
  }

  console.log(`\n=== DII/DIII Fix Summary ===`);
  console.log(`Fixed:      ${fixed}`);
  console.log(`Downloaded: ${downloaded}`);
  console.log(`Failed:     ${failed}`);

  for (const div of ['DII', 'DIII']) {
    const { rows: [have] } = await client.query(
      "SELECT count(*) FROM programs WHERE division = $1 AND logo_url IS NOT NULL", [div]
    );
    const { rows: [total] } = await client.query(
      "SELECT count(*) FROM programs WHERE division = $1", [div]
    );
    console.log(`${div}: ${have.count}/${total.count} with logos`);
  }

  client.release();
  await pool.end();
}

main().catch(console.error);
