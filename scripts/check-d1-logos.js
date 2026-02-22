const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.ufmzldfkdpjeyvjfpoid:MScp1BrdQZF8QBHp@aws-0-us-west-2.pooler.supabase.com:5432/postgres' });

async function main() {
  const { rows } = await pool.query(
    "SELECT id, school_name, espn_id, logo_url, division FROM programs WHERE division IN ('FBS','FCS') ORDER BY division, school_name"
  );

  console.log('=== D1 PROGRAMS MISSING LOGOS ===\n');
  let missing = 0;
  for (const r of rows) {
    if (!r.logo_url) {
      console.log(`MISSING  ${r.division} | ${r.school_name} | espn_id=${r.espn_id}`);
      missing++;
    }
  }

  console.log('\n=== D1 PROGRAMS WITH LOGOS (for spot-checking) ===\n');
  for (const r of rows) {
    if (r.logo_url && r.espn_id) {
      // Flag potential mismatches — e.g. UAB
    }
  }

  // Check UAB specifically
  const uab = rows.find(r => r.school_name.includes('Birmingham'));
  if (uab) console.log('\nUAB check:', JSON.stringify(uab));

  const appState = rows.find(r => r.school_name.includes('Appalachian'));
  if (appState) console.log('App State check:', JSON.stringify(appState));

  const arkState = rows.find(r => r.school_name.includes('Arkansas State'));
  if (arkState) console.log('Ark State check:', JSON.stringify(arkState));

  const miamiOH = rows.find(r => r.school_name.includes('Miami') && !r.school_name.includes('Florida'));
  if (miamiOH) console.log('Miami OH check:', JSON.stringify(miamiOH));

  console.log(`\nTotal D1: ${rows.length} | Missing logos: ${missing} | Have logos: ${rows.length - missing}`);
  await pool.end();
}
main();
