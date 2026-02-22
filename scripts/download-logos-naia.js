#!/usr/bin/env node
/**
 * Download NAIA logos from victorysportsnetwork.com team pages.
 * Visits each team page via Playwright and downloads the logo image.
 */

const { chromium } = require('playwright');
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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// VSN link text (short name) → our DB school_name
const NAME_MAP = {
  'Bluefield (Va.)': 'Bluefield University',
  'Kentucky Christian (Ky.)': 'Kentucky Christian University',
  'Pikeville (Ky.)': 'University of Pikeville',
  'Point (Ga.)': 'Point University',
  'Reinhardt (Ga.)': 'Reinhardt University',
  'University of Rio Grande (Ohio)': 'University of Rio Grande',
  'Union (Ky.)': 'Union Commonwealth University',
  'Dakota State (S.D.)': 'Dakota State University',
  'Dickinson State (N.D.)': 'Dickinson State University',
  'Mayville State (N.D.)': 'Mayville State University',
  'Montana State-Northern (Mont.)': 'Montana State University - Northern',
  'Montana Tech (Mont.)': 'Montana Tech of the University of Montana',
  'Rocky Mountain (Mont.)': 'Rocky Mountain College',
  'Valley City State (N.D.)': 'Valley City State University',
  'Arizona Christian (Ariz)': 'Arizona Christian University',
  'Carroll (Mont.)': 'Carroll College',
  'Eastern Oregon (Ore.)': 'Eastern Oregon University',
  'College of Idaho (Idaho)': 'The College of Idaho',
  'Montana Western (Mont.)': 'University of Montana - Western',
  'Simpson (Calif.)': 'Simpson University',
  'Southern Oregon (Ore.)': 'Southern Oregon University',
  'Briar Cliff (Iowa)': 'Briar Cliff University',
  'Concordia (Neb.)': 'Concordia University - Nebraska',
  'Dakota Wesleyan (S.D.)': 'Dakota Wesleyan University',
  'Doane (Neb.)': 'Doane University',
  'Dordt (Iowa)': 'Dordt University',
  'Hastings (Neb.)': 'Hastings College',
  'Midland University (Neb.)': 'Midland University',
  'Morningside (Iowa)': 'Morningside College',
  'Mount Marty (S.D.)': 'Mount Marty College',
  'Northwestern (Iowa)': 'Northwestern College - Iowa',
  'Waldorf (Iowa)': 'Waldorf University',
  'Clarke (Iowa)': 'Clarke University',
  'Culver-Stockton (Mo.)': 'Culver-Stockton College',
  'Graceland (Iowa)': 'Graceland University',
  'Grand View (Iowa)': 'Grand View University',
  'Peru State (Neb.)': 'Peru State College',
  'St. Ambrose (Iowa)': 'Saint Ambrose University',
  'William Penn (Iowa)': 'William Penn University',
  'Baker (Kan.)': 'Baker University',
  'Benedictine (Kan.)': 'Benedictine College',
  'Central Methodist (Mo.)': 'Central Methodist University',
  'MidAmerica Nazarene (Kan.)': 'MidAmerica Nazarene University',
  'Missouri Baptist (Mo.)': 'Missouri Baptist University',
  'Missouri Valley (Mo.)': 'Missouri Valley College',
  'William Woods (Mo.)': 'William Woods University',
  'Friends (Kan.)': 'Friends University',
  'Kansas Wesleyan (Kan.)': 'Kansas Wesleyan University',
  'McPherson (Kan.)': 'McPherson College',
  'Southwestern (Kan.)': 'Southwestern College - Kansas',
  'Sterling (Kan.)': 'Sterling College - Kansas',
  'St. Mary (Kan.)': 'University of Saint Mary',
  'Avila (Mo.)': 'Avila University',
  'Bethany (Kan.)': 'Bethany College - Kansas',
  'Bethel (Kan.)': 'Bethel College - Kansas',
  'Evangel (Mo.)': 'Evangel University',
  'Ottawa (Kan.)': 'Ottawa University',
  'Tabor (Kan.)': 'Tabor College',
  'Bethel (Tenn.)': 'Bethel University - Tennessee',
  'Campbellsville (Ky.)': 'Campbellsville University',
  'Cumberland (Tenn.)': 'Cumberland University',
  'Cumberlands (Ky.)': 'University of the Cumberlands',
  'Faulkner (Ala.)': 'Faulkner University',
  'Georgetown (Ky.)': 'Georgetown College - Kentucky',
  'Lindsey Wilson (Ky.)': 'Lindsey Wilson College',
  'Defiance College': 'Defiance College',
  'Indiana Wesleyan (Ind.)': 'Indiana Wesleyan University',
  'Lawrence Tech. (Mich.)': 'Lawrence Technological University',
  'Madonna (Mich.)': 'Madonna University',
  'Siena Heights (Mich.)': 'Siena Heights University',
  'Taylor (Ind.)': 'Taylor University',
  'Judson (Ill.)': 'Judson University',
  'Marian (Ind.)': 'Marian University - Indiana',
  'Olivet Nazarene (Ill.)': 'Olivet Nazarene University',
  'St. Francis (Ill.)': 'University of St. Francis - Illinois',
  'St. Francis (Ind.)': 'University of Saint Francis-Fort Wayne',
  'St. Xavier (Ill.)': 'Saint Xavier University',
  'Arkansas Baptist (Ark.)': 'Arkansas Baptist College',
  'Langston (Okla.)': 'Langston University',
  'Louisiana Christian (La.)': 'Louisiana Christian University',
  'Nelson University': 'Nelson University',
  'Oklahoma Panhandle State (Okla.)': 'Oklahoma Panhandle State University',
  'Ottawa (Ariz.) (OUAZ)': 'Ottawa University-Surprise',
  'Texas College (Texas)': 'Texas College',
  'Texas Wesleyan (Texas)': 'Texas Wesleyan University',
  'Wayland Baptist (Texas)': 'Wayland Baptist University',
  'Ave Maria (Fla.)': 'Ave Maria University',
  'Florida Memorial (Fla.)': 'Florida Memorial University',
  'Keiser (Fla.)': 'Keiser University (Formally Northwood University - FL Campus)',
  'St. Thomas (Fla.)': 'St. Thomas University - Florida',
  'Southeastern (Fla.)': 'Southeastern University',
  'Thomas (Ga.)': 'Thomas University',
  'Warner (Fla.)': 'Warner University',
  'Webber International (Fla.)': 'Webber International University',
};

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const client = await pool.connect();
  const browser = await chromium.launch({ headless: true });

  try {
    // Get NAIA programs missing logos
    const { rows: programs } = await client.query(
      "SELECT id, school_name FROM programs WHERE division = 'NAIA' AND logo_url IS NULL ORDER BY school_name"
    );
    console.log(`${programs.length} NAIA programs missing logos\n`);

    // Build lookup
    const byExactName = new Map();
    const byNormalized = new Map();
    for (const p of programs) {
      byExactName.set(p.school_name.toLowerCase(), p);
      byNormalized.set(normalize(p.school_name), p);
    }

    // Step 1: Get team links from the main page
    const page = await browser.newPage();
    await page.goto('https://victorysportsnetwork.com/naia-football-teams/', {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    for (let i = 0; i < 20; i++) {
      await page.evaluate(() => window.scrollBy(0, 500));
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(2000);

    const teamLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a'))
        .map(a => ({ href: a.href, text: a.textContent.trim() }))
        .filter(l => l.href.includes('naia-football-') && l.text.length > 3 && l.text.length < 80);
    });

    console.log(`Found ${teamLinks.length} team links\n`);

    let downloaded = 0, failed = 0, noMatch = 0, skipped = 0;

    for (const link of teamLinks) {
      // Match to our DB
      const mappedName = NAME_MAP[link.text];
      let prog = null;

      if (mappedName) {
        prog = byExactName.get(mappedName.toLowerCase());
      }
      if (!prog) {
        prog = byExactName.get(link.text.toLowerCase());
      }
      if (!prog) {
        prog = byNormalized.get(normalize(link.text));
      }

      if (!prog) {
        console.log(`  NO MATCH: "${link.text}" (mapped: ${mappedName || 'none'})`);
        noMatch++;
        continue;
      }

      const destPath = path.join(OUTPUT_DIR, `${prog.id}.png`);
      if (fs.existsSync(destPath)) {
        skipped++;
        continue;
      }

      // Visit team page and find logo
      try {
        await page.goto(link.href, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(2000);

        // Find the team logo — look for images in uploads that aren't the site logo
        const logoUrl = await page.evaluate(() => {
          const imgs = document.querySelectorAll('img');
          for (const img of imgs) {
            const src = img.src || img.getAttribute('data-src') || '';
            // Skip site logos and tiny images
            if (src.includes('uploads') &&
                !src.includes('favicon') &&
                !src.includes('profile-image') &&
                !src.includes('272-90') &&
                !src.includes('544-180') &&
                !src.includes('152.png') &&
                !src.includes('696x') &&
                img.width > 30) {
              return src;
            }
          }
          return null;
        });

        if (!logoUrl) {
          console.log(`  NO LOGO FOUND: ${link.text} (${link.href})`);
          failed++;
          continue;
        }

        // Download the logo
        const imgResponse = await page.goto(logoUrl, { timeout: 10000 });
        if (imgResponse && imgResponse.ok()) {
          const buffer = await imgResponse.body();
          if (buffer.length > 500) {
            fs.writeFileSync(destPath, buffer);
            const localUrl = `/logos/${prog.id}.png`;
            await client.query("UPDATE programs SET logo_url = $1 WHERE id = $2", [localUrl, prog.id]);
            downloaded++;
            console.log(`  OK ${prog.school_name} (${buffer.length} bytes)`);
          } else {
            console.log(`  TOO SMALL: ${link.text} (${buffer.length} bytes)`);
            failed++;
          }
        } else {
          console.log(`  DOWNLOAD FAILED: ${link.text}`);
          failed++;
        }
      } catch (err) {
        console.log(`  ERROR: ${link.text} — ${err.message.slice(0, 80)}`);
        failed++;
      }

      await sleep(500);
    }

    console.log(`\n=== NAIA Logo Summary ===`);
    console.log(`Downloaded: ${downloaded}`);
    console.log(`Skipped:    ${skipped}`);
    console.log(`Failed:     ${failed}`);
    console.log(`No match:   ${noMatch}`);

    const { rows: [c] } = await client.query(
      "SELECT count(*) FROM programs WHERE division = 'NAIA' AND logo_url IS NOT NULL"
    );
    const { rows: [t] } = await client.query(
      "SELECT count(*) FROM programs WHERE division = 'NAIA'"
    );
    console.log(`\nNAIA: ${c.count}/${t.count} with logos`);

  } finally {
    await browser.close();
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
