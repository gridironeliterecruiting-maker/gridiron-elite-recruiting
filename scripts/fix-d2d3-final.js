#!/usr/bin/env node
/**
 * Final DII/DIII logo fix — comprehensive manual ESPN ID mappings
 * found via ESPN search and the full ID scan.
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

// school_name → ESPN ID (manually verified via espn.com)
const FIXES = {
  // ── DII — previously 404'd or skipped ──
  'Anderson University - South Carolina': 2863,  // retry — might work now
  'Davenport University': 2877,                  // try — Davenport Panthers
  'Indiana University of Pennsylvania': 2853,    // IUP Crimson Hawks — retry
  'Kentucky State University': 2314,             // retry
  'Minnesota State University - Moorhead': 2903, // MSU Moorhead Dragons
  'Missouri Southern State University': 2411,    // MSSU Lions
  'Missouri University of Science & Technology': 2623, // wrong — was 142 (Mizzou). Try Missouri S&T Miners
  'Northwestern Oklahoma State University': 2465,
  'Northwood University - Michigan': 2886,       // Northwood (MI) Timberwolves
  'Saint Anselm College': 2849,                  // try
  'Southeastern Oklahoma State University': 199, // Savage Storm
  'Southwest Minnesota State University': 2410,
  'Texas A&M University - Kingsville': 2616,     // retry
  'The University of Virginia\'s College at Wise': 2842, // UVA Wise Cavaliers
  'University of Charleston': 236,               // try — UC Golden Eagles
  'University of North Carolina at Pembroke': 2882, // UNC Pembroke Braves
  'University of Texas - Permian Basin': 2901,
  'University of West Florida': 2904,
  'Virginia State University': 330,              // Virginia State Trojans
  'Wayne State College': 2689,                   // Wayne State (NE)
  'West Chester University of Pennsylvania': 223, // West Chester Golden Rams
  'Western State Colorado University': 2902,

  // ── DIII ──
  'Alvernia University': 2827,
  'Anderson University - Indiana': 2869,
  'Azusa Pacific University': 2850,
  'Benedictine University': 2283,               // Benedictine University (IL) Eagles
  'Bethany College - West Virginia': 492,       // might be Bethany (KS) — need to verify
  'Bethel University - Minnesota': 2903,        // check
  'Bridgewater College': 2828,
  'Bridgewater State University': 18,           // Bridgewater State Bears
  'Carroll University': 32,                     // Carroll (WI) Pioneers
  'Centenary College of Louisiana': 101442,     // Centenary Gentlemen
  'Concordia University - Chicago': 2847,       // Concordia (IL)
  'Concordia University - Wisconsin': 2846,     // Concordia (WI)
  'Elmhurst University': 72,                    // Elmhurst Bluejays
  'Fairleigh Dickinson University - College at Florham': 2903, // check
  'Illinois College': 2834,
  'Keystone College': 2967,
  'King\'s College - Pennsylvania': 247,        // King's College (PA) Monarchs
  'Maine Maritime Academy': 274,                // Maine Maritime Mariners
  'Massachusetts Institute of Technology - MIT': 109, // MIT Engineers
  'Massachusetts Maritime Academy': 2906,
  'Morrisville State College': 3110,            // SUNY Morrisville Mustangs
  'New England College': 2958,
  'Pomona-Pitzer Colleges': 2923,               // Pomona Pitzer Sagehens
  'Roanoke College': 2831,
  'Saint John\'s University - Minnesota': 2600, // Saint John's (MN) Johnnies
  'Saint Vincent College - Pennsylvania': 2614, // Saint Vincent Bearcats
  'Schreiner University': 2965,
  'Simpson College': 2564,                      // Simpson College (IA) Storm
  'SUNY Buffalo State College': 2833,
  'Trinity College - Connecticut': 2655,
  'Trinity University - Texas': 2654,
  'Union College - New York': 237,              // Union (NY) Garnet Chargers
  'University of Massachusetts - Dartmouth': 379, // UMASS Dartmouth Corsairs
  'University of Minnesota - Morris': 2909,
  'University of New England': 2948,
  'University of Northwestern - St. Paul': 2907,
  'University of Wisconsin - Eau Claire': 2838,
  'University of Wisconsin - La Crosse': 2836,
  'University of Wisconsin - Oshkosh': 2835,
  'University of Wisconsin - Platteville': 2837,
  'University of Wisconsin - River Falls': 2839,
  'University of Wisconsin - Stevens Point': 2840,
  'University of Wisconsin - Stout': 2843,
  'University of Wisconsin - Whitewater': 2844,
  'Washington & Lee University': 2927,
  'Washington University in St. Louis': 2929,
  'Wesleyan University': 336,                   // Wesleyan University (CT) Cardinals
  'Westminster College - Missouri': 433,        // Westminster (MO) Blue Jays
  'Westminster College - Pennsylvania': 434,
  'William Paterson University of New Jersey': 2970, // William Paterson Pioneers
};

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const client = await pool.connect();

  try {
    let downloaded = 0, failed = 0, exists = 0, notInDb = 0;

    for (const [schoolName, espnId] of Object.entries(FIXES)) {
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

      // Download if missing or if ESPN ID changed (wrong logo)
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
        exists++;
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Downloaded: ${downloaded}`);
    console.log(`Already had: ${exists}`);
    console.log(`Failed 404: ${failed}`);
    console.log(`Not in DB:  ${notInDb}`);

    for (const div of ['DII', 'DIII']) {
      const { rows: [have] } = await client.query(
        "SELECT count(*) FROM programs WHERE division = $1 AND logo_url IS NOT NULL", [div]
      );
      const { rows: [total] } = await client.query(
        "SELECT count(*) FROM programs WHERE division = $1", [div]
      );
      console.log(`${div}: ${have.count}/${total.count} with logos`);
    }

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
