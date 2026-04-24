// Generate + insert new coaches from spreadsheet_coaches.json
// Only inserts coaches where cc_source_key isn't already in the coaches table
// AND the row isn't marked removed in the spreadsheet.
const fs = require('fs');
const { Client } = require('pg');

const envText = fs.readFileSync('C:/Users/Paul Kongshaug/gridiron-elite-recruiting/app/.env.local.preview', 'utf8');
const dbUrl = envText.split('\n').find(l => l.startsWith('DATABASE_URL=')).slice('DATABASE_URL='.length).trim().replace(/^"|"$/g, '');

const spreadsheet = JSON.parse(fs.readFileSync('C:/Users/Paul Kongshaug/spreadsheet_coaches.json', 'utf8'));

// Normalize twitter: spreadsheet may give URL, handle with @, or raw handle
function normTwitter(t) {
  if (!t) return null;
  let h = String(t).trim();
  if (!h) return null;
  h = h.replace(/^https?:\/\/(www\.)?(twitter\.com|x\.com)\//i, '');
  h = h.replace(/^@/, '');
  h = h.split(/[?/]/)[0];
  return h || null;
}
function norm(v) { const s = (v ?? '').toString().trim(); return s || null; }

const DRY_RUN = process.argv.includes('--commit') ? false : true;

(async () => {
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected. Mode:', DRY_RUN ? 'DRY RUN' : 'COMMIT');

  // 1. Existing cc_source_keys in DB
  const existing = await client.query('SELECT cc_source_key FROM coaches WHERE cc_source_key IS NOT NULL');
  const existingKeys = new Set(existing.rows.map(r => r.cc_source_key));
  console.log('Existing cc_source_keys in DB:', existingKeys.size);

  // 2. Programs lookup (school_name → id) + aliases for spreadsheet name variants
  const programs = await client.query('SELECT id, school_name FROM programs');
  const schoolToId = new Map();
  for (const p of programs.rows) schoolToId.set(p.school_name.trim().toLowerCase(), p.id);

  const aliases = {
    'louisiana state university and agricultural & mechanical college': 'Louisiana State University (LSU)',
    'texas a & m university-college station': 'Texas A&M University',
    'keiser university (formally northwood university - fl campus)': 'Keiser University',
  };
  for (const [from, to] of Object.entries(aliases)) {
    const id = schoolToId.get(to.toLowerCase());
    if (id) schoolToId.set(from, id);
  }
  console.log('Programs:', programs.rows.length, '(+3 aliases)');

  // 3. Candidates = spreadsheet rows not in DB and not removed
  const candidates = spreadsheet.filter(c =>
    c.cc_source_key && !existingKeys.has(c.cc_source_key) && !c.removed
  );
  console.log('New-coach candidates in spreadsheet:', candidates.length);

  // 4. Map to rows + detect school mismatches
  const rows = [];
  const noProgram = [];
  for (const c of candidates) {
    const key = c.school.trim().toLowerCase();
    const programId = schoolToId.get(key);
    if (!programId) { noProgram.push(c); continue; }
    rows.push({
      program_id: programId,
      first_name: c.first_name,
      last_name: c.last_name,
      title: norm(c.title),
      email: norm(c.email),
      phone: norm(c.phone),
      twitter_handle: normTwitter(c.twitter),
      is_active: true,
      cc_source_key: c.cc_source_key,
    });
  }
  console.log('Mappable rows:', rows.length);
  console.log('Missing programs:', noProgram.length);
  if (noProgram.length) {
    const schools = [...new Set(noProgram.map(c => c.school))].slice(0, 20);
    console.log('  sample missing schools:', schools);
    fs.writeFileSync('C:/Users/Paul Kongshaug/missing_programs.json', JSON.stringify(noProgram, null, 2));
  }

  // 5. UPSERT by (program_id, first_name, last_name) so collisions update instead of fail
  let inserted = 0, updated = 0;
  const failed = [];
  await client.query('BEGIN');
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    await client.query('SAVEPOINT s');
    try {
      const res = await client.query(
        `INSERT INTO coaches (program_id, first_name, last_name, title, email, phone, twitter_handle, is_active, cc_source_key)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (program_id, first_name, last_name) DO UPDATE SET
           title = EXCLUDED.title,
           email = EXCLUDED.email,
           phone = EXCLUDED.phone,
           twitter_handle = EXCLUDED.twitter_handle,
           is_active = true,
           cc_source_key = EXCLUDED.cc_source_key,
           updated_at = NOW()
         RETURNING (xmax = 0) AS inserted`,
        [r.program_id, r.first_name, r.last_name, r.title, r.email, r.phone, r.twitter_handle, r.is_active, r.cc_source_key]
      );
      await client.query('RELEASE SAVEPOINT s');
      if (res.rows[0].inserted) inserted++; else updated++;
    } catch (e) {
      await client.query('ROLLBACK TO SAVEPOINT s');
      failed.push({ idx: i, row: r, err: e.message });
    }
    if ((i + 1) % 200 === 0) console.log(`  progress: ${i + 1}/${rows.length} (ins ${inserted}, upd ${updated}, fail ${failed.length})`);
  }
  const ok = inserted + updated;

  if (DRY_RUN) {
    await client.query('ROLLBACK');
    console.log(`\nDRY RUN — would insert ${inserted}, update ${updated}, fail ${failed.length}`);
  } else if (failed.length > 0) {
    await client.query('ROLLBACK');
    console.log(`\n❌ ROLLBACK — ${failed.length} failed`);
  } else {
    await client.query('COMMIT');
    console.log(`\n✅ COMMIT — inserted ${inserted}, updated ${updated}`);
  }

  if (failed.length) {
    const byErr = {};
    failed.forEach(f => { const k = f.err.slice(0, 80); byErr[k] = (byErr[k] || 0) + 1; });
    console.log('Failures:');
    Object.entries(byErr).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => console.log(`  ${v}× ${k}`));
    fs.writeFileSync('C:/Users/Paul Kongshaug/insert_failures.json', JSON.stringify(failed, null, 2));
  }

  await client.end();
})();
