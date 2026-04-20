// One-shot script: run the 1,777 coach UPDATE statements from coach_update_changes.sql
// against the Supabase Postgres DB using DATABASE_URL from .env.local.preview.
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const envPath = 'C:/Users/Paul Kongshaug/gridiron-elite-recruiting/app/.env.local.preview';
const envText = fs.readFileSync(envPath, 'utf8');
const dbUrlLine = envText.split('\n').find(l => l.startsWith('DATABASE_URL='));
if (!dbUrlLine) { console.error('No DATABASE_URL'); process.exit(1); }
const dbUrl = dbUrlLine.slice('DATABASE_URL='.length).trim().replace(/^"|"$/g, '');

const sqlPath = 'C:/Users/Paul Kongshaug/coach_update_changes.sql';
const sql = fs.readFileSync(sqlPath, 'utf8');

// Split into individual statements (skip comments and blanks)
const statements = sql.split('\n')
  .map(l => l.trim())
  .filter(l => l && !l.startsWith('--'));

console.log('DB host:', dbUrl.replace(/:[^:@]+@/, ':***@').split('@')[1]?.split('/')[0]);
console.log('Statements to run:', statements.length);

(async () => {
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected.');

  // DRY RUN: use savepoints so each failure doesn't abort the transaction, then ROLLBACK everything.
  // This gives us the true list of collisions before deciding how to handle.
  let ok = 0, failed = [];
  await client.query('BEGIN');
  try {
    for (let i = 0; i < statements.length; i++) {
      await client.query('SAVEPOINT s');
      try {
        await client.query(statements[i]);
        await client.query('RELEASE SAVEPOINT s');
        ok++;
      } catch (e) {
        await client.query('ROLLBACK TO SAVEPOINT s');
        failed.push({ idx: i, stmt: statements[i], err: e.message });
      }
      if ((i + 1) % 400 === 0) console.log(`  progress: ${i + 1}/${statements.length} (${failed.length} failures so far)`);
    }
    if (failed.length > 0) {
      await client.query('ROLLBACK');
      console.log(`\n❌ ROLLBACK — ${ok} ok, ${failed.length} failed`);
    } else {
      await client.query('COMMIT');
      console.log(`\n✅ COMMIT — ${ok} statements applied`);
    }
    fs.writeFileSync('C:/Users/Paul Kongshaug/update_failures.json', JSON.stringify(failed, null, 2));
    console.log('Wrote failures to C:/Users/Paul Kongshaug/update_failures.json');
    // Group error types
    const byErr = {};
    failed.forEach(f => {
      const key = f.err.slice(0, 80);
      byErr[key] = (byErr[key] || 0) + 1;
    });
    console.log('\nFailure breakdown:');
    Object.entries(byErr).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log(`  ${v}× ${k}`));
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Fatal:', e.message);
  } finally {
    await client.end();
  }
})();
