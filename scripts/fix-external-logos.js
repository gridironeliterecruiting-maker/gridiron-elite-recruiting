#!/usr/bin/env node
/**
 * fix-external-logos.js
 *
 * Finds all programs whose logo_url still points to an external HTTP URL,
 * downloads the logo locally to app/public/logos/{program_id}.png,
 * and updates the DB to use the local path.
 *
 * If the download fails (404, network error, etc.), sets logo_url = NULL
 * so the initials-based fallback displays instead of a broken image.
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString:
    'postgresql://postgres.ufmzldfkdpjeyvjfpoid:MScp1BrdQZF8QBHp@aws-0-us-west-2.pooler.supabase.com:5432/postgres',
});

const OUTPUT_DIR = path.join(__dirname, '..', 'app', 'public', 'logos');

async function main() {
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const client = await pool.connect();

  try {
    // 1. Query all programs with external logo URLs
    const { rows: programs } = await client.query(
      "SELECT id, school_name, logo_url FROM programs WHERE logo_url LIKE 'http%' ORDER BY school_name"
    );

    console.log(`Found ${programs.length} programs with external logo URLs\n`);

    let downloaded = 0;
    let failed = 0;

    for (const prog of programs) {
      const { id, school_name, logo_url } = prog;

      // 2. Extract ESPN ID from the URL (pattern: /ncaa/500/{id}.png)
      const match = logo_url.match(/\/ncaa\/500\/(\d+)\.png/);
      const espnId = match ? match[1] : null;

      const localPath = path.join(OUTPUT_DIR, `${id}.png`);
      const dbPath = `/logos/${id}.png`;

      // Skip if already downloaded
      if (fs.existsSync(localPath)) {
        console.log(`  SKIP  ${school_name} — already exists on disk`);
        await client.query('UPDATE programs SET logo_url = $1 WHERE id = $2', [dbPath, id]);
        downloaded++;
        continue;
      }

      try {
        // 3. Download the logo
        console.log(`  DL    ${school_name} — ${logo_url}`);
        const res = await fetch(logo_url);

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('image')) {
          throw new Error(`Not an image (content-type: ${contentType})`);
        }

        const buffer = Buffer.from(await res.arrayBuffer());

        if (buffer.length < 100) {
          throw new Error(`Suspiciously small file (${buffer.length} bytes)`);
        }

        fs.writeFileSync(localPath, buffer);

        // 4. Update DB to local path
        await client.query('UPDATE programs SET logo_url = $1 WHERE id = $2', [dbPath, id]);
        downloaded++;
        console.log(`  OK    ${school_name} → ${dbPath} (${(buffer.length / 1024).toFixed(1)} KB)`);
      } catch (err) {
        // 5. Download failed — set logo_url = NULL for initials fallback
        console.log(`  FAIL  ${school_name} — ${err.message} → setting logo_url = NULL`);
        await client.query('UPDATE programs SET logo_url = NULL WHERE id = $1', [id]);
        failed++;
      }

      // Small delay to be polite to ESPN servers
      await new Promise((r) => setTimeout(r, 100));
    }

    console.log(`\n--- Summary ---`);
    console.log(`Downloaded: ${downloaded}`);
    console.log(`Failed (set to NULL): ${failed}`);
    console.log(`Total processed: ${programs.length}`);

    // Final verification
    const { rows: [remaining] } = await client.query(
      "SELECT count(*) FROM programs WHERE logo_url LIKE 'http%'"
    );
    console.log(`\nRemaining external URLs: ${remaining.count}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
