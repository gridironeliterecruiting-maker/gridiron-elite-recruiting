#!/usr/bin/env node
/**
 * scrape-rml.js — Scrape coach data from RecruitingMasterList.com
 *
 * The RML football page uses Sheet2Site (backed by a Google Sheet) embedded
 * in an iframe. The data is loaded via a paginated API inside the iframe.
 * We use Playwright to:
 *   1. Log in to RML (requires manual CAPTCHA on first run)
 *   2. Navigate to the football page
 *   3. Access the iframe and click "Load More" until all data is loaded
 *   4. Extract all rows from the DataTable in the DOM
 *
 * Usage:
 *   node scrape-rml.js --login         # manual login (solve CAPTCHA), saves session
 *   node scrape-rml.js                 # headless scrape using saved session
 *   node scrape-rml.js --headed        # visible browser (for debugging)
 *   node scrape-rml.js --max-pages 3   # limit "Load More" clicks (for testing)
 *
 * Requires RML_USERNAME and RML_PASSWORD in .env for --login.
 * Output: ../data/rml_all_coaches.json
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const LOGIN_MODE = process.argv.includes('--login');
const HEADED = process.argv.includes('--headed') || LOGIN_MODE;
const MAX_PAGES_FLAG = process.argv.indexOf('--max-pages');
const MAX_PAGES = MAX_PAGES_FLAG !== -1 ? parseInt(process.argv[MAX_PAGES_FLAG + 1]) : Infinity;

const RML_USERNAME = process.env.RML_USERNAME;
const RML_PASSWORD = process.env.RML_PASSWORD;
const OUTPUT_FILE = path.resolve(__dirname, '..', 'data', 'rml_all_coaches.json');
const SESSION_FILE = path.resolve(__dirname, '..', 'data', '.rml-session.json');

const DELAY_BETWEEN_LOADS = 3000; // ms between "Load More" clicks

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Login mode — open browser, let user log in manually, save cookies
// ---------------------------------------------------------------------------
async function loginAndSaveSession() {
  console.log('\n=== RML Manual Login ===');
  console.log('A browser will open. Please:');
  console.log('  1. Log in to recruitingmasterlist.com');
  console.log('  2. Solve the CAPTCHA if prompted');
  console.log('  3. Once you see your account dashboard, come back here\n');

  if (!RML_USERNAME || !RML_PASSWORD) {
    console.error('ERROR: Set RML_USERNAME and RML_PASSWORD in .env');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    await page.goto('https://recruitingmasterlist.com/my-account/', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Pre-fill credentials
    try {
      await page.fill('#username', RML_USERNAME);
      await page.fill('#password', RML_PASSWORD);
      console.log('Credentials pre-filled. Solve the CAPTCHA and click Log In.');
    } catch (e) {
      console.log('Could not pre-fill. Please type credentials manually.');
    }

    // Wait for login (up to 10 minutes for CAPTCHA)
    console.log('Waiting for you to complete login in the browser...');
    console.log('(You have 10 minutes)\n');
    await page.waitForFunction(() => {
      // Detect login success by any of these indicators
      return document.querySelector('a[href*="logout"]') ||
             document.querySelector('.woocommerce-MyAccount-navigation') ||
             document.querySelector('.woocommerce-MyAccount-content') ||
             document.body.textContent.includes('Hello ') ||
             document.body.textContent.includes('Log out');
    }, null, { timeout: 600000 });

    console.log('Login detected! Saving session...');
    const cookies = await context.cookies();
    fs.writeFileSync(SESSION_FILE, JSON.stringify(cookies, null, 2));
    console.log(`Session saved to ${SESSION_FILE}`);
    console.log('\nYou can now run: node scrape-rml.js');

    await page.waitForTimeout(3000);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Main scrape logic
// ---------------------------------------------------------------------------
async function main() {
  if (LOGIN_MODE) {
    return loginAndSaveSession();
  }

  console.log(`\n=== RML Coach Scraper ===`);
  console.log(`Mode: ${HEADED ? 'HEADED' : 'HEADLESS'}`);
  console.log(`Max load-more clicks: ${MAX_PAGES === Infinity ? 'unlimited' : MAX_PAGES}\n`);

  // Load saved session
  if (!fs.existsSync(SESSION_FILE)) {
    console.error('No saved session. Run with --login first:');
    console.error('  node scrape-rml.js --login');
    process.exit(1);
  }

  const savedCookies = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
  console.log(`Loaded ${savedCookies.length} session cookies`);

  const browser = await chromium.launch({
    headless: !HEADED,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  await context.addCookies(savedCookies);
  const page = await context.newPage();

  try {
    // -------------------------------------------------------------------
    // Step 1: Navigate to football page
    // -------------------------------------------------------------------
    console.log('Navigating to football page...');
    await page.goto('https://recruitingmasterlist.com/football/', {
      waitUntil: 'domcontentloaded',
      timeout: 90000,
    });

    // Check if we're logged in — the football page may not show a logout link
    // directly, but if the iframe loads with coach data, we have access
    const loggedIn = await page.$('a[href*="logout"]');
    if (loggedIn) {
      console.log('Session valid (logout link found)!\n');
    } else {
      console.log('No logout link on this page — will verify via iframe data...\n');
    }

    // -------------------------------------------------------------------
    // Step 2: Access the Sheet2Site iframe
    // -------------------------------------------------------------------
    console.log('Waiting for iframe...');
    const iframeEl = await page.waitForSelector('iframe[id*="sheet2site"]', { timeout: 15000 });
    const frame = await iframeEl.contentFrame();
    if (!frame) {
      throw new Error('Could not access iframe content');
    }

    // Wait for DataTable to initialize
    console.log('Waiting for table to load...');
    await frame.waitForSelector('#example', { timeout: 15000 });
    await sleep(2000); // Let DataTables fully render

    // -------------------------------------------------------------------
    // Step 3: Click "Load More" until all data is loaded
    // -------------------------------------------------------------------
    let loadMoreClicks = 0;
    while (loadMoreClicks < MAX_PAGES) {
      const loadMoreBtn = await frame.$('#load_more_btn');
      if (!loadMoreBtn) {
        console.log('No "Load More" button found — all data loaded.');
        break;
      }

      const btnText = await loadMoreBtn.textContent();
      if (!btnText || btnText.trim().toLowerCase().includes('subscribe') || !btnText.trim()) {
        console.log('Load More button gone or replaced — all data loaded.');
        break;
      }

      // Check if button is disabled
      const isDisabled = await loadMoreBtn.evaluate(el => el.disabled);
      if (isDisabled) {
        console.log('Waiting for current load to finish...');
        await sleep(2000);
        continue;
      }

      await loadMoreBtn.click();
      loadMoreClicks++;
      console.log(`  Load More click #${loadMoreClicks}...`);

      // Wait for data to load
      await sleep(DELAY_BETWEEN_LOADS);

      // Wait for button to become re-enabled or disappear
      try {
        await frame.waitForFunction(() => {
          const btn = document.querySelector('#load_more_btn');
          if (!btn) return true;
          if (btn.disabled) return false;
          return true;
        }, { timeout: 30000 });
      } catch (e) {
        console.log('  Timeout waiting for load, continuing...');
      }
    }

    // -------------------------------------------------------------------
    // Step 4: Extract all data from the table
    // -------------------------------------------------------------------
    console.log('\nExtracting coach data from table...');

    // Destroy DataTable to show all rows (DataTables paginates the DOM)
    await frame.evaluate(() => {
      if ($.fn.DataTable.isDataTable('#example')) {
        $('#example').DataTable().destroy();
      }
    });
    await sleep(1000);

    const coaches = await frame.evaluate(() => {
      const rows = document.querySelectorAll('#example tbody tr');
      const results = [];

      for (const row of rows) {
        const cells = row.querySelectorAll('td');
        if (cells.length < 6) continue;

        // Extract text from buttons/badges inside cells
        const getText = (cell) => {
          if (!cell) return '';
          // Check for button text first
          const btn = cell.querySelector('button');
          if (btn) return btn.textContent.trim();
          // Check for badge text (combine multiple badges)
          const badges = cell.querySelectorAll('.badge');
          if (badges.length > 0) {
            return Array.from(badges).map(b => b.textContent.trim()).join('');
          }
          return cell.textContent.trim();
        };

        // Extract email from mailto link
        const getEmail = (cell) => {
          if (!cell) return '';
          const link = cell.querySelector('a[href^="mailto:"]');
          if (link) return link.getAttribute('href').replace('mailto:', '');
          return cell.textContent.trim();
        };

        // Extract twitter handle
        const getTwitter = (cell) => {
          if (!cell) return '';
          const btn = cell.querySelector('button');
          if (btn) return btn.textContent.trim();
          return cell.textContent.trim();
        };

        // Columns: School(0), Name(1), Position(2), Twitter(3), Phone(4),
        //          Email(5), Division(6), DMs Open(7), Conference(8),
        //          State(9), Recruiter(10), Questionnaire(11)
        const coach = {
          school: getText(cells[0]),
          name: getText(cells[1]),
          position: getText(cells[2]),
          twitter: getTwitter(cells[3]),
          phone: getText(cells[4]),
          email: getEmail(cells[5]),
          division: getText(cells[6]),
          dm_open: getText(cells[7]),
          conference: getText(cells[8]),
          state: getText(cells[9]),
          recruiter: getText(cells[10]),
          questionnaire_link: cells[11] && cells[11].querySelector('a') ? 'Recruiting Questionnaire' : '',
        };

        if (coach.school && coach.name) {
          results.push(coach);
        }
      }

      return results;
    });

    console.log(`Extracted ${coaches.length} coaches`);

    // -------------------------------------------------------------------
    // Step 5: Save results
    // -------------------------------------------------------------------
    const outDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(coaches, null, 2));
    console.log(`Saved to: ${OUTPUT_FILE}`);

    // Refresh session cookies
    const freshCookies = await context.cookies();
    fs.writeFileSync(SESSION_FILE, JSON.stringify(freshCookies, null, 2));
    console.log('Session cookies refreshed.');

    console.log(`\n=== Scrape Complete ===`);
    console.log(`Total coaches: ${coaches.length}`);
    console.log(`Load More clicks: ${loadMoreClicks}`);

  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('\nFATAL:', err.message);
  console.error(err.stack);
  process.exit(1);
});
