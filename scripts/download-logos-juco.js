#!/usr/bin/env node
/**
 * Download JUCO logos from the NJCAA stats site using Playwright.
 * Visits the teams page, collects team links, then visits each team
 * page to find and download logo images (bypassing Cloudflare via browser).
 *
 * Usage: node download-logos-juco.js
 */

const { chromium } = require('playwright');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: 'postgresql://postgres.ufmzldfkdpjeyvjfpoid:MScp1BrdQZF8QBHp@aws-0-us-west-2.pooler.supabase.com:5432/postgres'
});

const OUTPUT_DIR = path.join(__dirname, '..', 'app', 'public', 'logos');
const TEAMS_PAGE = 'https://njcaastats.prestosports.com/sports/fball/teams-page';

function normalize(s) {
  return s.toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Manual mappings: NJCAA site team name → our DB school_name
// Use null to explicitly skip a team
const NAME_MAP = {
  'Butler CC': 'Butler Community College',
  'Georgia Military': 'Georgia Military College - Milledgeville',
  'Itawamba CC': 'Itawamba Community College -- Fulton Campus',
  'Jones College': 'Jones County Junior College',
  'Monroe University': 'Monroe University - New Rochelle',
  'Central Lakes College-Brainerd': 'Central Lakes College - Brainerd',
  'Central Lakes': 'Central Lakes College - Brainerd',
  'Erie CC': 'SUNY Erie Community College',
  'Erie Community College': 'SUNY Erie Community College',
  'Hudson Valley CC': 'SUNY Hudson Valley Community College',
  'Hudson Valley Community College': 'SUNY Hudson Valley Community College',
  'Minnesota North-Mesabi Range': 'Mesabi Range College',
  'Minnesota North College-Mesabi Range': 'Mesabi Range College',
  'Minnesota North-Vermilion': 'Vermilion Community College',
  'Minnesota North College-Vermilion': 'Vermilion Community College',
  'Minnesota State Community and Technical College': 'Minnesota State Community & Technical College',
  'Minnesota State CTC': 'Minnesota State Community & Technical College',
  'Rochester CTC': 'Rochester Community & Technical College',
  'Rochester Community and Technical College': 'Rochester Community & Technical College',
  'Highland CC': 'Highland Community College - Kansas',
  'Highland Community College': 'Highland Community College - Kansas',
  'Highland Community College - Kansas': 'Highland Community College - Kansas',
  'Butler Community College - KS': 'Butler Community College',
  'Georgia Military College': 'Georgia Military College - Milledgeville',
  'Minnesota West Community & Technical College': 'Minnesota West Community and Technical College',
  'Community Christian (Mich.)': null, // skip — not in our DB
  'Community Christian College': null, // skip — not in our DB
  // Add more mappings here as you discover mismatches
};

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const client = await pool.connect();
  const browser = await chromium.launch({ headless: true });

  try {
    // Get JUCO programs missing logos
    const { rows: programs } = await client.query(
      "SELECT id, school_name FROM programs WHERE division = 'JUCO' AND logo_url IS NULL ORDER BY school_name"
    );
    console.log(`${programs.length} JUCO programs missing logos\n`);

    if (programs.length === 0) {
      console.log('Nothing to do!');
      return;
    }

    // Build lookup maps
    const byExactName = new Map();
    const byNormalized = new Map();
    for (const p of programs) {
      byExactName.set(p.school_name.toLowerCase(), p);
      byNormalized.set(normalize(p.school_name), p);
    }

    // Also build a "contains" lookup — DB name words that are distinctive
    // This helps with partial matches like "Blinn" matching "Blinn College"
    const byKeyword = new Map();
    for (const p of programs) {
      // Use the first significant word (>4 chars) as a keyword
      const words = p.school_name.split(/\s+/).filter(w => w.length > 4);
      for (const w of words) {
        const key = w.toLowerCase();
        // Only use keywords that are unique
        if (!byKeyword.has(key)) {
          byKeyword.set(key, p);
        } else {
          byKeyword.set(key, null); // Mark as ambiguous
        }
      }
    }

    // Step 1: Visit the teams page
    const page = await browser.newPage();
    console.log(`Visiting ${TEAMS_PAGE}...`);
    await page.goto(TEAMS_PAGE, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Wait extra time for Cloudflare challenge if present
    await page.waitForTimeout(5000);

    // Check for Cloudflare challenge page
    const title = await page.title();
    if (title.toLowerCase().includes('just a moment') || title.toLowerCase().includes('cloudflare')) {
      console.log('Cloudflare challenge detected, waiting 15 seconds...');
      await page.waitForTimeout(15000);
    }

    // Scroll the page to trigger lazy loading
    for (let i = 0; i < 30; i++) {
      await page.evaluate(() => window.scrollBy(0, 500));
      await page.waitForTimeout(300);
    }
    // Scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(2000);

    // Step 2: Collect all team links
    // NJCAA stats uses prestosports — team links typically point to /sports/fball/2024-25/teams/<slug>
    const teamLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a'))
        .map(a => ({ href: a.href, text: a.textContent.trim() }))
        .filter(l => {
          // Filter for team-specific links on the NJCAA stats site
          return (
            l.href.includes('/sports/fball/') &&
            l.href.includes('/teams/') &&
            !l.href.endsWith('/teams-page') &&
            !l.href.endsWith('/teams') &&
            l.text.length > 3 &&
            l.text.length < 100 &&
            l.text !== 'Stats' &&
            l.text !== 'Roster'
          );
        });
    });

    // Deduplicate by href
    const seen = new Set();
    const uniqueLinks = [];
    for (const link of teamLinks) {
      if (!seen.has(link.href)) {
        seen.add(link.href);
        uniqueLinks.push(link);
      }
    }

    console.log(`Found ${uniqueLinks.length} unique team links\n`);

    if (uniqueLinks.length === 0) {
      // Dump page content for debugging
      const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 2000));
      console.log('Page content preview:');
      console.log(bodyText);
      console.log('\nNo team links found. The page structure may have changed.');
      return;
    }

    let downloaded = 0, failed = 0, noMatch = 0, skipped = 0, alreadyHave = 0;

    for (const link of uniqueLinks) {
      // Match the team name to our DB
      const mappedName = NAME_MAP[link.text];
      let prog = null;

      if (mappedName === null) {
        // Explicitly skipped
        continue;
      } else if (mappedName) {
        prog = byExactName.get(mappedName.toLowerCase());
      }

      // Try exact match on link text
      if (!prog) {
        prog = byExactName.get(link.text.toLowerCase());
      }

      // Try normalized match
      if (!prog) {
        prog = byNormalized.get(normalize(link.text));
      }

      if (!prog) {
        console.log(`  NO MATCH: "${link.text}" → ${link.href}`);
        noMatch++;
        continue;
      }

      const destPath = path.join(OUTPUT_DIR, `${prog.id}.png`);
      if (fs.existsSync(destPath)) {
        // Already downloaded, just ensure DB is updated
        const localUrl = `/logos/${prog.id}.png`;
        await client.query("UPDATE programs SET logo_url = $1 WHERE id = $2", [localUrl, prog.id]);
        alreadyHave++;
        continue;
      }

      // Step 3: Visit team page and find logo
      try {
        await page.goto(link.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000); // Extra wait for Cloudflare / lazy images

        // Check for Cloudflare challenge again
        const pageTitle = await page.title();
        if (pageTitle.toLowerCase().includes('just a moment') || pageTitle.toLowerCase().includes('cloudflare')) {
          console.log('  Cloudflare challenge on team page, waiting 15 seconds...');
          await page.waitForTimeout(15000);
        }

        // Find the logo element and screenshot it directly
        // (bypasses both CDN 403 and CORS — uses browser's own rendering)
        const logoHandle = await page.evaluateHandle(() => {
          const imgs = document.querySelectorAll('img');

          // Priority 1: CDN logo images
          for (const img of imgs) {
            const src = img.src || img.getAttribute('data-src') || '';
            if (src.includes('cdn.prestosports.com') && src.includes('logos') && img.naturalWidth > 10) {
              return img;
            }
          }

          // Priority 2: any CDN image that looks like a logo
          for (const img of imgs) {
            const src = img.src || img.getAttribute('data-src') || '';
            if (
              src.includes('cdn.prestosports.com') &&
              !src.includes('headshot') &&
              !src.includes('player') &&
              !src.includes('background') &&
              !src.includes('banner') &&
              img.naturalWidth > 30 &&
              img.naturalWidth < 500
            ) {
              return img;
            }
          }

          return null;
        });

        const logoElement = logoHandle.asElement();
        if (!logoElement) {
          console.log(`  NO LOGO FOUND: "${link.text}" (${link.href})`);
          failed++;
          continue;
        }

        // Screenshot just the logo element — saves as PNG
        const buffer = await logoElement.screenshot({ type: 'png' });
        if (buffer.length > 500) {
          fs.writeFileSync(destPath, buffer);
          const localUrl = `/logos/${prog.id}.png`;
          await client.query("UPDATE programs SET logo_url = $1 WHERE id = $2", [localUrl, prog.id]);
          downloaded++;
          console.log(`  OK: ${prog.school_name} (${buffer.length} bytes)`);
        } else {
          console.log(`  TOO SMALL: "${link.text}" (${buffer.length} bytes)`);
          failed++;
        }
      } catch (err) {
        console.log(`  ERROR: "${link.text}" — ${err.message.slice(0, 100)}`);
        failed++;
      }

      await sleep(1000); // Be polite — 1 second between page loads
    }

    // Summary
    console.log(`\n=== JUCO Logo Download Summary ===`);
    console.log(`Downloaded:    ${downloaded}`);
    console.log(`Already had:   ${alreadyHave}`);
    console.log(`Failed:        ${failed}`);
    console.log(`No match:      ${noMatch}`);

    const { rows: [withLogos] } = await client.query(
      "SELECT count(*) FROM programs WHERE division = 'JUCO' AND logo_url IS NOT NULL"
    );
    const { rows: [total] } = await client.query(
      "SELECT count(*) FROM programs WHERE division = 'JUCO'"
    );
    console.log(`\nJUCO: ${withLogos.count}/${total.count} programs with logos`);

  } finally {
    await browser.close();
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
