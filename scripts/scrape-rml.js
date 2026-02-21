#!/usr/bin/env node
/**
 * scrape-rml.js — Scrape coach data from RecruitingMasterList.com
 *
 * Usage:
 *   node scrape-rml.js                # headless scrape, full run
 *   node scrape-rml.js --headed       # visible browser (for debugging)
 *   node scrape-rml.js --max-pages 3  # limit pages (for testing)
 *
 * Requires RML_USERNAME and RML_PASSWORD in .env (or environment).
 * Output: ../data/rml_all_coaches.json
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const HEADED = process.argv.includes('--headed');
const MAX_PAGES_FLAG = process.argv.indexOf('--max-pages');
const MAX_PAGES = MAX_PAGES_FLAG !== -1 ? parseInt(process.argv[MAX_PAGES_FLAG + 1]) : Infinity;

const RML_USERNAME = process.env.RML_USERNAME;
const RML_PASSWORD = process.env.RML_PASSWORD;
const OUTPUT_FILE = path.resolve(__dirname, '..', 'data', 'rml_all_coaches.json');

const DELAY_BETWEEN_ROWS = 300;   // ms between expanding rows
const DELAY_BETWEEN_PAGES = 2000; // ms between page navigations
const SESSION_CHECK_INTERVAL = 100; // re-check login every N rows

if (!RML_USERNAME || !RML_PASSWORD) {
  console.error('ERROR: Set RML_USERNAME and RML_PASSWORD in .env');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Main scrape logic
// ---------------------------------------------------------------------------
async function main() {
  console.log(`\n=== RML Coach Scraper ===`);
  console.log(`Mode: ${HEADED ? 'HEADED (visible browser)' : 'HEADLESS'}`);
  console.log(`Max pages: ${MAX_PAGES === Infinity ? 'unlimited' : MAX_PAGES}\n`);

  const browser = await chromium.launch({
    headless: !HEADED,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    // -------------------------------------------------------------------
    // Step 1: Log in
    // -------------------------------------------------------------------
    console.log('Navigating to login page...');
    await page.goto('https://recruitingmasterlist.com/my-account/', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Fill login form (WooCommerce standard)
    console.log('Logging in...');
    await page.fill('#username', RML_USERNAME);
    await page.fill('#password', RML_PASSWORD);
    await page.click('button[name="login"], input[name="login"]');
    await page.waitForLoadState('networkidle', { timeout: 15000 });

    // Verify login succeeded — look for logout link or my-account dashboard
    const loggedIn = await page.$('a[href*="logout"], .woocommerce-MyAccount-navigation');
    if (!loggedIn) {
      // Check for error message
      const errorEl = await page.$('.woocommerce-error');
      const errorText = errorEl ? await errorEl.textContent() : 'Unknown error';
      throw new Error(`Login failed: ${errorText}`);
    }
    console.log('Login successful!\n');

    // -------------------------------------------------------------------
    // Step 2: Navigate to football page
    // -------------------------------------------------------------------
    console.log('Navigating to football coach list...');
    await page.goto('https://recruitingmasterlist.com/football/', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    const allCoaches = [];
    let pageNum = 0;
    let totalRowsProcessed = 0;

    // -------------------------------------------------------------------
    // Step 3: Paginate and scrape
    // -------------------------------------------------------------------
    while (pageNum < MAX_PAGES) {
      pageNum++;
      console.log(`\n--- Page ${pageNum} ---`);

      // Wait for the table to be present
      await page.waitForSelector('table', { timeout: 15000 });

      // Get all data rows (skip header)
      const rows = await page.$$('table tbody tr');
      console.log(`Found ${rows.length} rows on this page`);

      if (rows.length === 0) {
        console.log('No rows found, stopping.');
        break;
      }

      for (let r = 0; r < rows.length; r++) {
        try {
          const row = rows[r];

          // Extract basic info from the visible row
          const cells = await row.$$('td');
          if (cells.length === 0) continue;

          // Try to extract data from the visible columns
          // Typical columns: School, Name, Position, Division, Conference, State
          // The exact structure will vary — we try to read what's available
          const rowData = {};

          // Get the visible cell texts
          const cellTexts = [];
          for (const cell of cells) {
            cellTexts.push((await cell.textContent()).trim());
          }

          // Try clicking the expand button (green "+") to reveal contact details
          const expandBtn = await row.$('.expand-button, .toggle-details, button.expand, [class*="expand"], td button, td a.expand');
          if (expandBtn) {
            await expandBtn.click();
            await sleep(DELAY_BETWEEN_ROWS);

            // Look for expanded detail row that appears after clicking
            const detailRow = await row.evaluateHandle(el => el.nextElementSibling);
            if (detailRow) {
              const detailText = await detailRow.evaluate(el => el ? el.textContent : '');
              // Parse contact details from expanded content
              rowData._expandedDetail = detailText;
            }
          }

          // Try to extract structured data from the row
          // This is a best-effort extraction — exact selectors need to be
          // discovered by running in --headed mode and inspecting the DOM
          const coach = await extractCoachData(row, cellTexts, rowData);
          if (coach && coach.school && coach.name) {
            allCoaches.push(coach);
          }

          totalRowsProcessed++;

          // Session timeout check
          if (totalRowsProcessed % SESSION_CHECK_INTERVAL === 0) {
            console.log(`  Processed ${totalRowsProcessed} rows total, checking session...`);
            const stillLoggedIn = await page.$('a[href*="logout"]');
            if (!stillLoggedIn) {
              console.log('  Session expired, re-logging in...');
              await reLogin(page);
              await page.goto('https://recruitingmasterlist.com/football/', {
                waitUntil: 'networkidle',
              });
              // Re-navigate to current page
              for (let p = 1; p < pageNum; p++) {
                const nextBtn = await page.$('.next, .pagination-next, a.next_page, [rel="next"]');
                if (nextBtn) {
                  await nextBtn.click();
                  await page.waitForLoadState('networkidle');
                }
              }
              break; // Re-process this page
            }
          }
        } catch (err) {
          console.warn(`  Error processing row ${r}: ${err.message}`);
        }
      }

      console.log(`  Scraped ${allCoaches.length} coaches so far`);

      // Navigate to next page
      const nextButton = await page.$('.next, .pagination-next, a.next_page, [rel="next"], .paginate_button.next:not(.disabled)');
      if (!nextButton) {
        console.log('\nNo next page button found — reached last page.');
        break;
      }

      // Check if next button is disabled
      const isDisabled = await nextButton.evaluate(el =>
        el.classList.contains('disabled') ||
        el.getAttribute('aria-disabled') === 'true' ||
        el.hasAttribute('disabled')
      );
      if (isDisabled) {
        console.log('\nNext button is disabled — reached last page.');
        break;
      }

      await nextButton.click();
      await sleep(DELAY_BETWEEN_PAGES);
      await page.waitForLoadState('networkidle', { timeout: 15000 });
    }

    // -------------------------------------------------------------------
    // Step 4: Save results
    // -------------------------------------------------------------------
    console.log(`\n=== Scrape Complete ===`);
    console.log(`Total coaches scraped: ${allCoaches.length}`);
    console.log(`Total pages processed: ${pageNum}`);

    // Ensure output directory exists
    const outDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allCoaches, null, 2));
    console.log(`Saved to: ${OUTPUT_FILE}`);

  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Extract coach data from a table row
// ---------------------------------------------------------------------------
// NOTE: These selectors are placeholders. Run with --headed to inspect the
// actual DOM structure and update accordingly. The RML site is WordPress
// with a custom or plugin-based table — the exact class names and structure
// need to be discovered at runtime.
async function extractCoachData(row, cellTexts, rowData) {
  const coach = {
    school: '',
    name: '',
    position: '',
    twitter: '',
    phone: '',
    email: '',
    division: '',
    dm_open: '',
    conference: '',
    state: '',
    recruiter: '',
    questionnaire_link: '',
  };

  // Strategy 1: Try data attributes
  try {
    const dataAttrs = await row.evaluate(el => {
      const obj = {};
      for (const attr of el.attributes) {
        if (attr.name.startsWith('data-')) {
          obj[attr.name.replace('data-', '')] = attr.value;
        }
      }
      return obj;
    });
    if (dataAttrs.school) coach.school = dataAttrs.school;
    if (dataAttrs.name) coach.name = dataAttrs.name;
    if (dataAttrs.division) coach.division = dataAttrs.division;
  } catch (e) { /* ignore */ }

  // Strategy 2: Map cell texts by position
  // Common table layouts:
  //   [School, Name, Position, Division, Conference, State, ...]
  //   Adjust indices based on actual DOM inspection
  if (cellTexts.length >= 6 && !coach.school) {
    coach.school = cellTexts[0] || '';
    coach.name = cellTexts[1] || '';
    coach.position = cellTexts[2] || '';
    coach.division = cellTexts[3] || '';
    coach.conference = cellTexts[4] || '';
    coach.state = cellTexts[5] || '';
  }

  // Strategy 3: Extract contact details from expanded row
  if (rowData._expandedDetail) {
    const detail = rowData._expandedDetail;

    // Try to find email
    const emailMatch = detail.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    if (emailMatch) coach.email = emailMatch[0];

    // Try to find phone
    const phoneMatch = detail.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
    if (phoneMatch) coach.phone = phoneMatch[0];

    // Try to find twitter handle
    const twitterMatch = detail.match(/@[\w]+/);
    if (twitterMatch) coach.twitter = twitterMatch[0];

    // DM open indicator
    if (/dm\s*open|dms?\s*:?\s*yes/i.test(detail)) {
      coach.dm_open = 'Yes';
    }

    // Recruiter indicator
    if (/recruiter/i.test(detail)) {
      coach.recruiter = 'Recruiter';
    }

    // Questionnaire link
    if (/questionnaire/i.test(detail)) {
      coach.questionnaire_link = 'Recruiting Questionnaire';
    }
  }

  // Strategy 4: Try specific selectors within the row
  try {
    const emailLink = await row.$('a[href^="mailto:"]');
    if (emailLink) {
      const href = await emailLink.getAttribute('href');
      coach.email = href.replace('mailto:', '');
    }
  } catch (e) { /* ignore */ }

  try {
    const twitterLink = await row.$('a[href*="twitter.com"], a[href*="x.com"]');
    if (twitterLink) {
      const href = await twitterLink.getAttribute('href');
      const handle = href.match(/(?:twitter\.com|x\.com)\/([\w]+)/);
      if (handle) coach.twitter = '@' + handle[1];
    }
  } catch (e) { /* ignore */ }

  return coach;
}

// ---------------------------------------------------------------------------
// Re-login helper (session timeout recovery)
// ---------------------------------------------------------------------------
async function reLogin(page) {
  await page.goto('https://recruitingmasterlist.com/my-account/', {
    waitUntil: 'networkidle',
    timeout: 30000,
  });
  await page.fill('#username', RML_USERNAME);
  await page.fill('#password', RML_PASSWORD);
  await page.click('button[name="login"], input[name="login"]');
  await page.waitForLoadState('networkidle', { timeout: 15000 });

  const loggedIn = await page.$('a[href*="logout"]');
  if (!loggedIn) {
    throw new Error('Re-login failed');
  }
  console.log('  Re-login successful');
}

main().catch(err => {
  console.error('\nFATAL:', err.message);
  console.error(err.stack);
  process.exit(1);
});
