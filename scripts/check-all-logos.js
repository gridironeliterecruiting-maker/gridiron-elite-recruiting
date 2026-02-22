const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.ufmzldfkdpjeyvjfpoid:MScp1BrdQZF8QBHp@aws-0-us-west-2.pooler.supabase.com:5432/postgres' });

async function main() {
  for (const div of ['FBS','FCS','DII','DIII','NAIA','JUCO']) {
    const { rows: [h] } = await pool.query('SELECT count(*) FROM programs WHERE division = $1 AND logo_url IS NOT NULL', [div]);
    const { rows: [t] } = await pool.query('SELECT count(*) FROM programs WHERE division = $1', [div]);
    console.log(`${div}: ${h.count}/${t.count} with logos`);
  }
  const { rows: [h] } = await pool.query('SELECT count(*) FROM programs WHERE logo_url IS NOT NULL');
  const { rows: [t] } = await pool.query('SELECT count(*) FROM programs');
  console.log(`\nTotal: ${h.count}/${t.count} with logos`);
  await pool.end();
}
main();
