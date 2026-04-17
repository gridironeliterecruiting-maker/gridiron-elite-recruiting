// Silent-drop detection:
// For every program that has ≥1 active coach in the spreadsheet, find active DB coaches
// whose cc_source_key is not in the spreadsheet. Those are "silent drops" — the source
// no longer lists them on staff, without explicitly marking them Removed.
//
// Exclusions (must never touch):
//   1. Protected rows (null source keys, or email in PROTECTED_EMAILS)
//   2. Coaches with ANY email_sends OR filed_emails activity (active thread protection)
//
// Usage: node scripts/silent-drop-scan.js <xlsx-path>
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { Client } = require('pg');

const SHEETS = ['FBS', 'FCS', 'DII', 'DIII', 'JuCo', 'NAIA'];
const PROTECTED_EMAILS = new Set([
  'paulkongshaug@gmail.com', 'gridironeliterecruiting@gmail.com', 'paulkong3@gmail.com',
  'warriorfamily03@gmail.com', 'warriorfamily05@gmail.com', 'hawkeyefirefootball@gmail.com',
  'raglefantman@gmail.com', 'theonewithskills33@gmail.com',
]);
const SCHOOL_ALIASES = {
  'louisiana state university and agricultural & mechanical college': 'Louisiana State University (LSU)',
  'texas a & m university-college station': 'Texas A&M University',
  'keiser university (formally northwood university - fl campus)': 'Keiser University',
  'state university of new york at cortland': 'SUNY Cortland',
};

function isProtected(dbRow) {
  if (!dbRow.cc_source_key && !dbRow.rml_source_key) return true;
  if (dbRow.email && PROTECTED_EMAILS.has(dbRow.email.toLowerCase())) return true;
  return false;
}

async function main() {
  const xlsxPath = process.argv[2];
  if (!xlsxPath) { console.error('Usage: node silent-drop-scan.js <xlsx-path>'); process.exit(1); }

  const envText = fs.readFileSync(path.resolve(__dirname, '..', '.env.local.preview'), 'utf8');
  const dbUrl = envText.split('\n').find(l => l.startsWith('DATABASE_URL=')).slice('DATABASE_URL='.length).trim().replace(/^"|"$/g, '');

  // Parse xlsx — collect (cc_source_key, school) for active rows
  const wb = XLSX.readFile(xlsxPath);
  const activeByKey = new Map(); // key → school
  for (const sheetName of SHEETS) {
    if (!wb.Sheets[sheetName]) continue;
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { range: 5 });
    for (const row of rows) {
      const uid = row['Unique ID'];
      if (!uid) continue;
      const removed = String(row['Removed? (y)'] || '').trim().toLowerCase() === 'y';
      if (removed) continue;
      activeByKey.set(String(uid).trim(), (row['School'] || '').trim());
    }
  }
  console.log(`Active coaches in spreadsheet: ${activeByKey.size}`);

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    const programs = (await client.query('SELECT id, school_name FROM programs')).rows;
    const schoolToId = new Map();
    for (const p of programs) schoolToId.set(p.school_name.trim().toLowerCase(), p.id);
    for (const [from, to] of Object.entries(SCHOOL_ALIASES)) {
      const id = schoolToId.get(to.toLowerCase());
      if (id) schoolToId.set(from, id);
    }

    // Programs represented in the spreadsheet (any active row at that school)
    const coveredPrograms = new Set();
    for (const school of activeByKey.values()) {
      const id = schoolToId.get(school.toLowerCase());
      if (id) coveredPrograms.add(id);
    }
    console.log(`Programs represented in spreadsheet: ${coveredPrograms.size}`);

    // All active DB coaches at those programs
    const coaches = (await client.query(
      `SELECT id, cc_source_key, rml_source_key, program_id, first_name, last_name, title, email
       FROM coaches WHERE is_active = true AND program_id = ANY($1)`,
      [[...coveredPrograms]]
    )).rows;
    console.log(`Active DB coaches at covered programs: ${coaches.length}`);

    // Candidates = active, has cc_source_key, key not in spreadsheet, not protected
    const candidates = coaches.filter(c =>
      c.cc_source_key && !activeByKey.has(c.cc_source_key) && !isProtected(c)
    );
    console.log(`Silent-drop candidates (before thread guard): ${candidates.length}`);

    // Thread guard: exclude anyone with ANY email_sends or filed_emails activity
    const candidateIds = candidates.map(c => c.id);
    const withThreads = new Set();
    if (candidateIds.length) {
      const r1 = (await client.query(
        `SELECT DISTINCT coach_id FROM email_sends WHERE coach_id = ANY($1)`,
        [candidateIds]
      )).rows;
      const r2 = (await client.query(
        `SELECT DISTINCT coach_id FROM filed_emails WHERE coach_id = ANY($1)`,
        [candidateIds]
      )).rows;
      for (const r of r1) withThreads.add(r.coach_id);
      for (const r of r2) withThreads.add(r.coach_id);
    }

    const safeDrops = candidates.filter(c => !withThreads.has(c.id));
    const threadProtected = candidates.filter(c => withThreads.has(c.id));

    console.log(`Thread-protected (skipped — have email activity): ${threadProtected.length}`);
    console.log(`── SAFE silent-drop deactivations: ${safeDrops.length} ──\n`);

    // Group by school for reporting
    const byProgram = new Map();
    for (const c of safeDrops) {
      if (!byProgram.has(c.program_id)) byProgram.set(c.program_id, []);
      byProgram.get(c.program_id).push(c);
    }
    const programLookup = new Map(programs.map(p => [p.id, p.school_name]));
    const perSchool = [...byProgram.entries()]
      .map(([pid, coaches]) => ({ school: programLookup.get(pid), n: coaches.length, coaches }))
      .sort((a, b) => b.n - a.n);

    console.log('Top 15 schools by silent-drop count:');
    perSchool.slice(0, 15).forEach(s => console.log(`  ${s.n}× ${s.school}`));
    console.log('\nSample 10 coaches to be deactivated:');
    safeDrops.slice(0, 10).forEach(c => console.log(`  ${c.cc_source_key} | ${c.first_name} ${c.last_name} (${c.title || 'no title'}) — ${programLookup.get(c.program_id)}`));

    // Write full list for later commit
    fs.writeFileSync(
      path.join(path.dirname(xlsxPath), 'silent_drops.json'),
      JSON.stringify({
        generated_at: new Date().toISOString(),
        xlsx: xlsxPath,
        total_active_in_sheet: activeByKey.size,
        programs_covered: coveredPrograms.size,
        candidates_before_threadguard: candidates.length,
        thread_protected: threadProtected.length,
        safe_to_deactivate: safeDrops.map(c => ({
          id: c.id, cc_source_key: c.cc_source_key,
          first_name: c.first_name, last_name: c.last_name,
          title: c.title, email: c.email,
          school: programLookup.get(c.program_id),
        })),
        kept_thread_protected: threadProtected.map(c => ({
          id: c.id, cc_source_key: c.cc_source_key,
          first_name: c.first_name, last_name: c.last_name,
          email: c.email, school: programLookup.get(c.program_id),
        })),
      }, null, 2)
    );
    console.log(`\nWrote full plan to ${path.join(path.dirname(xlsxPath), 'silent_drops.json')}`);

    // Spot-check the Drake target coaches Paul called out
    console.log('\nSpot-check — Paul\'s flagged coaches:');
    for (const key of ['DI104510', 'DI104511']) {  // Kyle Kempt, Joe Evans (already removed today)
      const c = coaches.find(c => c.cc_source_key === key);
      console.log(`  ${key}: ${c ? c.first_name + ' ' + c.last_name + ' active' : 'already inactive (correct)'}`);
    }
  } finally {
    await client.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
