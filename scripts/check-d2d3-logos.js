const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.ufmzldfkdpjeyvjfpoid:MScp1BrdQZF8QBHp@aws-0-us-west-2.pooler.supabase.com:5432/postgres' });

async function main() {
  for (const div of ['DII', 'DIII']) {
    const { rows } = await pool.query(
      "SELECT id, school_name, espn_id, logo_url FROM programs WHERE division = $1 ORDER BY school_name",
      [div]
    );
    const missing = rows.filter(r => !r.logo_url);
    console.log(`\n=== ${div}: ${missing.length} missing of ${rows.length} ===\n`);
    for (const r of missing) {
      console.log(`  ${r.school_name}`);
    }
  }
  await pool.end();
}
main();
