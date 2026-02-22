const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.ufmzldfkdpjeyvjfpoid:MScp1BrdQZF8QBHp@aws-0-us-west-2.pooler.supabase.com:5432/postgres' });

async function main() {
  const { rows } = await pool.query(
    "SELECT id, school_name, logo_url FROM programs WHERE division = 'NAIA' AND logo_url IS NULL ORDER BY school_name"
  );
  console.log(`\n=== ${rows.length} NAIA programs still missing logos ===\n`);
  for (const r of rows) {
    console.log(`  "${r.school_name}"`);
  }
  
  // Also show total
  const { rows: [total] } = await pool.query("SELECT count(*) FROM programs WHERE division = 'NAIA'");
  const { rows: [have] } = await pool.query("SELECT count(*) FROM programs WHERE division = 'NAIA' AND logo_url IS NOT NULL");
  console.log(`\nNAIA: ${have.count}/${total.count} with logos`);
  
  await pool.end();
}
main();
