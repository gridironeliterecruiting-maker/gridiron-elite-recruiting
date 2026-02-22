#!/usr/bin/env node
/**
 * Fix D1 (FBS + FCS) logo gaps with manual ESPN ID mappings.
 * Also fixes wrong mappings (e.g. UAB → Alabama).
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

// school_name (from DB) → correct ESPN ID
// Found by searching https://www.espn.com/college-football/team/_/id/{id}
const D1_FIXES = {
  // ── FBS wrong mapping ──
  'University of Alabama - Birmingham': 5,        // UAB Blazers (was incorrectly 333 = Alabama)

  // ── FBS missing ──
  'Appalachian State University': 2026,
  'Arkansas State University': 2032,
  'California State University - Fresno': 278,    // Fresno State
  'Georgia State University': 2247,
  'Miami University': 193,                         // Miami (OH) RedHawks
  'San Diego State University': 21,
  'San Jose State University': 23,
  'Southern Methodist University': 2567,           // SMU
  'SUNY University at Albany': 399,                // Albany Great Danes
  'SUNY University at Buffalo': 2084,              // Buffalo Bulls
  'United States Military Academy': 349,           // Army
  'United States Naval Academy': 2426,             // Navy
  'University of Connecticut': 41,                 // UConn
  'University of Louisiana - Lafayette': 309,      // Louisiana Ragin' Cajuns
  'University of Louisiana - Monroe': 2433,        // UL Monroe
  'University of Massachusetts - Amherst': 113,    // UMass
  'University of Nevada - Las Vegas': 2439,        // UNLV
  'University of Nevada - Reno': 2440,             // Nevada
  'University of North Carolina at Chapel Hill': 153, // UNC
  'University of Southern Mississippi': 2572,      // Southern Miss
  'University of Texas - El Paso': 2638,           // UTEP
  'University of Texas - San Antonio': 2636,       // UTSA

  // ── FCS missing ──
  'California Polytechnic State University - San Luis Obispo': 13, // Cal Poly
  'California State University - Sacramento': 16,  // Sacramento State
  'Chicago State University': 2130,
  'Citadel Military College of South Carolina': 2643, // The Citadel
  'Cornell University': 172,
  'Delaware State University': 2169,
  'Georgetown University': 46,
  'Idaho State University': 304,
  'Indiana State University': 282,
  'Missouri State University': 2623,
  'Monmouth University': 2405,
  'Northwestern State University of Louisiana': 2466, // Northwestern State
  'Prairie View A & M University': 2504,           // Prairie View A&M
  'Robert Morris University - Pennsylvania': 2523, // Robert Morris
  'Southeast Missouri State University': 2546,     // SEMO
  'Southeastern Louisiana University': 2545,
  'Southern Illinois University Carbondale': 79,   // SIU
  'Southern University & A&M College': 2582,       // Southern University
  'Stephen F Austin State University': 2617,       // SFA
  'University of Arkansas at Pine Bluff': 2029,
  'University of California - Davis': 302,         // UC Davis
  'University of Pennsylvania - Penn': 219,        // Penn
  'University of St. Thomas - Minnesota': 2900,    // St. Thomas
  'University of Tennessee - Martin': 2630,        // UT Martin
  'University of Texas - Rio Grande Valley': 292,
  'Virginia Military Institute - VMI': 2678,       // VMI
};

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const client = await pool.connect();

  try {
    let fixed = 0, downloaded = 0, failed = 0;

    for (const [schoolName, espnId] of Object.entries(D1_FIXES)) {
      // Look up program
      const { rows } = await client.query(
        "SELECT id, espn_id, logo_url FROM programs WHERE school_name = $1",
        [schoolName]
      );

      if (rows.length === 0) {
        console.log(`  NOT IN DB: ${schoolName}`);
        continue;
      }

      const prog = rows[0];
      const destPath = path.join(OUTPUT_DIR, `${prog.id}.png`);
      const localUrl = `/logos/${prog.id}.png`;

      // Download (or re-download if wrong logo)
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
            console.log(`  ✓ ${schoolName} → ESPN ${espnId}`);
          } else {
            console.log(`  ✗ 404: ${schoolName} (ESPN ${espnId})`);
            failed++;
          }
        } catch (err) {
          console.log(`  ✗ Error: ${schoolName} — ${err.message}`);
          failed++;
        }
        await sleep(100);
      } else {
        // Just make sure DB is correct
        if (prog.logo_url !== localUrl || prog.espn_id !== espnId) {
          await client.query(
            "UPDATE programs SET espn_id = $1, logo_url = $2 WHERE id = $3",
            [espnId, localUrl, prog.id]
          );
        }
        console.log(`  = ${schoolName} (already have file)`);
      }
      fixed++;
    }

    console.log(`\n=== D1 Fix Summary ===`);
    console.log(`Fixed:      ${fixed}`);
    console.log(`Downloaded: ${downloaded}`);
    console.log(`Failed:     ${failed}`);

    // Final count
    const { rows: [fbs] } = await client.query(
      "SELECT count(*) FROM programs WHERE division = 'FBS' AND logo_url IS NOT NULL"
    );
    const { rows: [fbsTotal] } = await client.query(
      "SELECT count(*) FROM programs WHERE division = 'FBS'"
    );
    const { rows: [fcs] } = await client.query(
      "SELECT count(*) FROM programs WHERE division = 'FCS' AND logo_url IS NOT NULL"
    );
    const { rows: [fcsTotal] } = await client.query(
      "SELECT count(*) FROM programs WHERE division = 'FCS'"
    );
    console.log(`\nFBS: ${fbs.count}/${fbsTotal.count} with logos`);
    console.log(`FCS: ${fcs.count}/${fcsTotal.count} with logos`);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
