const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({ connectionString: 'postgresql://postgres.ufmzldfkdpjeyvjfpoid:MScp1BrdQZF8QBHp@aws-0-us-west-2.pooler.supabase.com:5432/postgres' });
const LOGOS_DIR = path.join(__dirname, '..', 'app', 'public', 'logos');

async function main() {
  const { rows } = await pool.query(
    "SELECT id, school_name, division, logo_url FROM programs WHERE logo_url IS NOT NULL ORDER BY division, school_name"
  );
  
  let broken = 0;
  let ok = 0;
  let external = 0;
  const brokenList = [];
  
  for (const r of rows) {
    if (r.logo_url.startsWith('/logos/')) {
      const filePath = path.join(LOGOS_DIR, path.basename(r.logo_url));
      if (!fs.existsSync(filePath)) {
        broken++;
        brokenList.push(r);
      } else {
        // Check file size too
        const stats = fs.statSync(filePath);
        if (stats.size < 100) {
          broken++;
          brokenList.push({ ...r, note: `tiny file: ${stats.size} bytes` });
        } else {
          ok++;
        }
      }
    } else {
      // External URL (old ESPN CDN links?)
      external++;
      brokenList.push({ ...r, note: 'external URL' });
    }
  }
  
  console.log(`OK (local file exists): ${ok}`);
  console.log(`Broken (file missing): ${broken}`);
  console.log(`External URLs: ${external}`);
  
  if (brokenList.length > 0) {
    console.log(`\n=== Broken/External logos ===\n`);
    for (const r of brokenList) {
      console.log(`  [${r.division}] ${r.school_name}: ${r.logo_url}${r.note ? ' — ' + r.note : ''}`);
    }
  }
  
  await pool.end();
}
main();
