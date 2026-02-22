#!/usr/bin/env node
/**
 * Download JUCO logos from NJCAA's prestosports CDN.
 * Matches NJCAA team names to our programs and downloads logos.
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: 'postgresql://postgres.ufmzldfkdpjeyvjfpoid:MScp1BrdQZF8QBHp@aws-0-us-west-2.pooler.supabase.com:5432/postgres'
});

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

// NJCAA teams scraped from https://njcaastats.prestosports.com/sports/fball/teams-page
// Format: [njcaaName, logoUrl]
const NJCAA_TEAMS = [
  // Division I
  ["Andrew College", "https://cdn.prestosports.com/action/cdn/logos/id/iyc8842yukof7byo.png"],
  ["Blinn College", "https://cdn.prestosports.com/action/cdn/logos/id/c9sbfm41hj84edr2.png"],
  ["Butler Community College", "https://cdn.prestosports.com/action/cdn/logos/id/pm8rxqyzbknf6wl5.png"],
  ["Central Georgia Technical College", "https://cdn.prestosports.com/action/cdn/logos/id/i2bczumvb6ba9i5g.png"],
  ["Cisco College", "https://cdn.prestosports.com/action/cdn/logos/id/fz2go6wamk78rvt8.png"],
  ["Coahoma Community College", "https://cdn.prestosports.com/action/cdn/logos/id/0c019yifscid8vb2.png"],
  ["Coffeyville Community College", "https://cdn.prestosports.com/action/cdn/logos/id/ln69y4xciujtp2md.png"],
  ["Copiah-Lincoln Community College", "https://cdn.prestosports.com/action/cdn/logos/id/hp9sn9abikly2psd.png"],
  ["Dodge City Community College", "https://cdn.prestosports.com/action/cdn/logos/id/e6j92veysgu4eb7d.png"],
  ["East Central Community College", "https://cdn.prestosports.com/action/cdn/logos/id/exzdb15w717vg4yj.png"],
  ["East Mississippi Community College", "https://cdn.prestosports.com/action/cdn/logos/id/zwkvbe2wjuozyhrk.png"],
  ["Ellsworth Community College", "https://cdn.prestosports.com/action/cdn/logos/id/s68jvyvn7b18ntvb.png"],
  ["Garden City Community College", "https://cdn.prestosports.com/action/cdn/logos/id/1zis26ipr0uvnp20.png"],
  ["Georgia Military College", "https://cdn.prestosports.com/action/cdn/logos/id/9iovd4lj46vlbu66.png"],
  ["Highland Community College - Kansas", "https://cdn.prestosports.com/action/cdn/logos/id/i4o901bo2n23xn3x.png"],
  ["Hinds Community College", "https://cdn.prestosports.com/action/cdn/logos/id/pcu40actr350tj37.png"],
  ["Holmes Community College", "https://cdn.prestosports.com/action/cdn/logos/id/5lrkq3kd3se1bk5y.png"],
  ["Hutchinson Community College", "https://cdn.prestosports.com/action/cdn/logos/id/66pv98lfn0zygx5j.png"],
  ["Independence Community College", "https://cdn.prestosports.com/action/cdn/logos/id/rjtuqy69gbc2lx5c.png"],
  ["Iowa Central Community College", "https://cdn.prestosports.com/action/cdn/logos/id/6tnklap0wwv96pig.png"],
  ["Iowa Western Community College", "https://cdn.prestosports.com/action/cdn/logos/id/1k2q5q9d50sf3tos.png"],
  ["Itawamba Community College", "https://cdn.prestosports.com/action/cdn/logos/id/w2ewrx5qurynd1p2.png"],
  ["Jones College", "https://cdn.prestosports.com/action/cdn/logos/id/q3h3ol6ztgr1tacj.png"],
  ["Kilgore College", "https://cdn.prestosports.com/action/cdn/logos/id/iptmm07w0pnv29u8.png"],
  ["Lackawanna College", "https://cdn.prestosports.com/action/cdn/logos/id/1opnk2c0v5u7ylmm.png"],
  ["Mississippi Delta Community College", "https://cdn.prestosports.com/action/cdn/logos/id/4jqzrcu20wjs55zz.png"],
  ["Mississippi Gulf Coast Community College", "https://cdn.prestosports.com/action/cdn/logos/id/w5zztz45ernbzg6m.png"],
  ["Monroe University", "https://cdn.prestosports.com/action/cdn/logos/id/t1w0dwcih6iay9jw.png"],
  ["Navarro College", "https://cdn.prestosports.com/action/cdn/logos/id/0zpwd6qkiwgp7xsk.png"],
  ["New Mexico Military Institute", "https://cdn.prestosports.com/action/cdn/logos/id/9rp16gtlt3dmhmrl.png"],
  ["Northeast Mississippi Community College", "https://cdn.prestosports.com/action/cdn/logos/id/kgnlen04nuqsucky.png"],
  ["Northeastern Oklahoma A&M College", "https://cdn.prestosports.com/action/cdn/logos/id/oof92wwvmlwa8y8f.png"],
  ["Northwest Mississippi Community College", "https://cdn.prestosports.com/action/cdn/logos/id/590bukqv97r1m1ey.png"],
  ["Pearl River Community College", "https://cdn.prestosports.com/action/cdn/logos/id/tj83tb6m6xw81nt4.png"],
  ["Snow College", "https://cdn.prestosports.com/action/cdn/logos/id/dpqp82rx5ly5f9ar.png"],
  ["Southwest Mississippi Community College", "https://cdn.prestosports.com/action/cdn/logos/id/27t26j947fiuq0b5.png"],
  ["Sussex County Community College", "https://cdn.prestosports.com/action/cdn/logos/id/5u09wj8ft3e4am5g.png"],
  ["Trinity Valley Community College", "https://cdn.prestosports.com/action/cdn/logos/id/w5i7zdhcy4jm4bur.png"],
  ["Tyler Junior College", "https://cdn.prestosports.com/action/cdn/logos/id/3dvqb7459o99nppd.png"],
  // Division III
  ["Central Lakes College-Brainerd", "https://cdn.prestosports.com/action/cdn/logos/id/5su6p4b0dssr4hx9.png"],
  ["College of DuPage", "https://cdn.prestosports.com/action/cdn/logos/id/3bp8l9v79jzu9gb1.png"],
  ["Erie Community College", "https://cdn.prestosports.com/action/cdn/logos/id/p5on481zz1twg4mc.png"],
  ["Hocking College", "https://cdn.prestosports.com/action/cdn/logos/id/f8gq5vwyhjqfc5eu.png"],
  ["Hudson Valley Community College", "https://cdn.prestosports.com/action/cdn/logos/id/rs8kjoctph3gy8xo.png"],
  ["Louisburg College", "https://cdn.prestosports.com/action/cdn/logos/id/2qvh8n9vytril8qy.png"],
  ["Minnesota North College-Mesabi Range", "https://cdn.prestosports.com/action/cdn/logos/id/0319kfd787rqbswh.png"],
  ["Minnesota North College-Vermilion", "https://cdn.prestosports.com/action/cdn/logos/id/sb2l9s22ljy0m5jv.png"],
  ["Minnesota State Community and Technical College", "https://cdn.prestosports.com/action/cdn/logos/id/xjcedog6vbzurmuj.png"],
  ["Minnesota West Community & Technical College", "https://cdn.prestosports.com/action/cdn/logos/id/z415lwwgmv0ptzzm.png"],
  ["Nassau Community College", "https://cdn.prestosports.com/action/cdn/logos/id/pzfe9d26rqc1juss.png"],
  ["North Dakota State College of Science", "https://cdn.prestosports.com/action/cdn/logos/id/o40nm5osfcjdlpib.png"],
  ["Rochester Community and Technical College", "https://cdn.prestosports.com/action/cdn/logos/id/c280ivi0uqdduowt.png"],
  // Community Christian entries — skip (two listed, likely small programs not in our DB)
];

// Manual mappings: NJCAA name → our DB school_name (for names that don't match exactly)
const NAME_MAP = {
  "Butler Community College": "Butler Community College",
  "Georgia Military College": "Georgia Military College - Milledgeville",
  "Itawamba Community College": "Itawamba Community College -- Fulton Campus",
  "Jones College": "Jones County Junior College",
  "Monroe University": "Monroe University - New Rochelle",
  "Central Lakes College-Brainerd": "Central Lakes College - Brainerd",
  "Erie Community College": "SUNY Erie Community College",
  "Hudson Valley Community College": "SUNY Hudson Valley Community College",
  "Minnesota North College-Mesabi Range": "Mesabi Range College",
  "Minnesota North College-Vermilion": "Vermilion Community College",
  "Minnesota State Community and Technical College": "Minnesota State Community & Technical College",
  "Minnesota West Community & Technical College": null, // check if in DB
  "Rochester Community and Technical College": "Rochester Community & Technical College",
  "Highland Community College - Kansas": "Highland Community College - Kansas",
};

async function downloadLogo(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) return false;
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buffer);
  return true;
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const client = await pool.connect();
  try {
    // Get all JUCO programs without logos
    const { rows: programs } = await client.query(
      "SELECT id, school_name FROM programs WHERE division = 'JUCO' AND logo_url IS NULL ORDER BY school_name"
    );
    console.log(`${programs.length} JUCO programs missing logos\n`);

    // Build lookup: normalized name → program
    const byExactName = new Map();
    const byNormalized = new Map();
    for (const p of programs) {
      byExactName.set(p.school_name.toLowerCase(), p);
      byNormalized.set(normalize(p.school_name), p);
    }

    let matched = 0, downloaded = 0, failed = 0, noMatch = 0;

    for (const [njcaaName, logoUrl] of NJCAA_TEAMS) {
      // Try manual mapping first
      const mappedName = NAME_MAP[njcaaName];
      let prog = null;

      if (mappedName === null) {
        // Explicitly skipped
        continue;
      } else if (mappedName) {
        prog = byExactName.get(mappedName.toLowerCase());
      }

      // Try exact match
      if (!prog) {
        prog = byExactName.get(njcaaName.toLowerCase());
      }

      // Try normalized match
      if (!prog) {
        prog = byNormalized.get(normalize(njcaaName));
      }

      if (!prog) {
        console.log(`  No match: ${njcaaName}`);
        noMatch++;
        continue;
      }

      matched++;
      const destPath = path.join(OUTPUT_DIR, `${prog.id}.png`);
      const localUrl = `/logos/${prog.id}.png`;

      if (fs.existsSync(destPath)) {
        // File exists, just update DB
        await client.query("UPDATE programs SET logo_url = $1 WHERE id = $2", [localUrl, prog.id]);
        continue;
      }

      try {
        const ok = await downloadLogo(logoUrl, destPath);
        if (ok) {
          await client.query("UPDATE programs SET logo_url = $1 WHERE id = $2", [localUrl, prog.id]);
          downloaded++;
          console.log(`  Downloaded: ${prog.school_name}`);
        } else {
          console.log(`  Failed: ${prog.school_name} (${logoUrl})`);
          failed++;
        }
      } catch (err) {
        console.log(`  Error: ${prog.school_name} — ${err.message}`);
        failed++;
      }

      await sleep(100);
    }

    console.log('\n=== NJCAA Logo Summary ===');
    console.log(`Matched:    ${matched}`);
    console.log(`Downloaded: ${downloaded}`);
    console.log(`Failed:     ${failed}`);
    console.log(`No match:   ${noMatch}`);

    const { rows: [c] } = await client.query("SELECT count(*) FROM programs WHERE logo_url IS NOT NULL AND division = 'JUCO'");
    console.log(`\nJUCO programs with logos: ${c.count} / 119`);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
