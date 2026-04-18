#!/usr/bin/env node
// Monthly coaches-database import.
//
// Usage:
//   node scripts/import-coaches-spreadsheet.js <path-to-xlsx>              # dry run
//   node scripts/import-coaches-spreadsheet.js <path-to-xlsx> --commit     # apply
//
// What it does, end to end:
//   1. Parse the .xlsx (FBS, FCS, DII, DIII, JuCo, NAIA sheets; header at row 5)
//   2. Dedupe by "Unique ID" (cc_source_key), last sheet wins
//   3. Load current DB state (programs + coaches)
//   4. Resolve each coach's program_id via school name + SCHOOL_ALIASES
//   5. Compute diffs:
//        - Deactivations: spreadsheet rows with Removed=y AND key exists + active in DB
//        - Updates:       key exists in DB, fields differ
//        - Upserts:       key not in DB (insert) OR (program, first, last) collision (update)
//   6. Print diff summary; if --commit, apply in a transaction with savepoints
//
// Source of truth for edge cases lives in ~/.claude/memory/coach_import_playbook.md
//
// Dependencies: xlsx (npm i --no-save xlsx), pg (npm i --no-save pg)
// DB credentials pulled from app/.env.local.preview -> DATABASE_URL

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { Client } = require('pg');

// ────────────────────────────────────────────────────────────────────────
// Config
// ────────────────────────────────────────────────────────────────────────

const SHEETS = ['FBS', 'FCS', 'DII', 'DIII', 'JuCo', 'NAIA'];
const HEADER_ROW_INDEX = 5; // 0-indexed; real headers live at row 6 in Excel

// Map spreadsheet sheet name → programs.division enum value
const SHEET_TO_DIVISION = { FBS: 'FBS', FCS: 'FCS', DII: 'DII', DIII: 'DIII', JuCo: 'JUCO', NAIA: 'NAIA' };

// Spreadsheet school-name variants that map to existing program rows under a different name.
// Keys are lower-cased exact matches against the spreadsheet's "School" column.
// If the source starts using a new variant, add it here — don't rename the program row.
// DO NOT TOUCH — Paul's manually-added test coaches. See memory/feedback_protected_test_coaches.md
// These emails mark rows that must never be modified, deactivated, or overwritten by the import.
// Match is case-insensitive against coaches.email.
const PROTECTED_EMAILS = new Set([
  'paulkongshaug@gmail.com',
  'gridironeliterecruiting@gmail.com',
  'paulkong3@gmail.com',
  'warriorfamily03@gmail.com',
  'warriorfamily05@gmail.com',
  'hawkeyefirefootball@gmail.com',
  'raglefantman@gmail.com',
  'theonewithskills33@gmail.com',
].map(e => e.toLowerCase()));

function isProtected(dbRow) {
  if (!dbRow) return false;
  // Any row without a source key is potentially a test/placeholder (incl. Team Twitter Handle rows)
  if (!dbRow.cc_source_key && !dbRow.rml_source_key) return true;
  if (dbRow.email && PROTECTED_EMAILS.has(dbRow.email.toLowerCase())) return true;
  return false;
}

const SCHOOL_ALIASES = {
  'louisiana state university and agricultural & mechanical college': 'Louisiana State University (LSU)',
  'texas a & m university-college station': 'Texas A&M University',
  'keiser university (formally northwood university - fl campus)': 'Keiser University',
  'state university of new york at cortland': 'SUNY Cortland',
};

// ────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────

function loadDbUrl() {
  const envPath = path.resolve(__dirname, '..', '.env.local.preview');
  const envText = fs.readFileSync(envPath, 'utf8');
  const line = envText.split('\n').find(l => l.startsWith('DATABASE_URL='));
  if (!line) throw new Error('DATABASE_URL not found in ' + envPath);
  return line.slice('DATABASE_URL='.length).trim().replace(/^"|"$/g, '');
}

function normTwitter(raw) {
  if (!raw) return null;
  let h = String(raw).trim();
  if (!h) return null;
  // Strip full URLs (incl. mobile./m./www. subdomains on twitter.com or x.com)
  h = h.replace(/^https?:\/\/([a-z0-9-]+\.)*(twitter\.com|x\.com)\//i, '');
  // Orphan scheme like "https:" or "https://" alone → treat as empty
  if (/^https?:\/?\/?$/i.test(h) || /^https?:$/i.test(h)) return null;
  h = h.replace(/^@/, '');
  h = h.split(/[?/]/)[0];
  return h || null;
}

function norm(v) {
  const s = (v ?? '').toString().trim();
  return s || null;
}

function parseSpreadsheet(xlsxPath) {
  const wb = XLSX.readFile(xlsxPath);
  const all = [];
  for (const sheetName of SHEETS) {
    if (!wb.Sheets[sheetName]) continue;
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { range: HEADER_ROW_INDEX });
    for (const row of rows) {
      const uid = row['Unique ID'];
      if (!uid) continue;

      // The "Individual's Twitter" header sometimes contains a line-break
      let twitter = '';
      for (const k of Object.keys(row)) {
        if (k.includes('Individual') && k.toLowerCase().includes('twitter')) {
          twitter = String(row[k] || '').trim();
          break;
        }
      }

      all.push({
        cc_source_key: String(uid).trim(),
        school: (row['School'] || '').trim(),
        first_name: (row['First name'] || '').trim(),
        last_name: (row['Last name'] || '').trim(),
        title: norm(row['Position']),
        email: (row['Email address'] || '').trim().toLowerCase() || null,
        phone: norm(row['Phone number']),
        twitter_handle: normTwitter(twitter),
        division: SHEET_TO_DIVISION[sheetName],
        conference: norm(row['Conference']),
        removed: String(row['Removed? (y)'] || '').trim().toLowerCase() === 'y',
      });
    }
  }
  // Dedupe by key — last occurrence wins
  const byKey = new Map();
  for (const c of all) byKey.set(c.cc_source_key, c);
  return [...byKey.values()];
}

function buildSchoolLookup(programs) {
  const lookup = new Map();
  for (const p of programs) lookup.set(p.school_name.trim().toLowerCase(), p.id);
  for (const [from, to] of Object.entries(SCHOOL_ALIASES)) {
    const id = lookup.get(to.toLowerCase());
    if (id) lookup.set(from, id);
  }
  return lookup;
}

function fieldsDiffer(dbRow, sheetRow) {
  return (
    (dbRow.title || null) !== sheetRow.title ||
    (dbRow.email || null) !== sheetRow.email ||
    (dbRow.phone || null) !== sheetRow.phone ||
    (dbRow.twitter_handle || null) !== sheetRow.twitter_handle ||
    (dbRow.first_name || '') !== sheetRow.first_name ||
    (dbRow.last_name || '') !== sheetRow.last_name ||
    dbRow.is_active !== true
  );
}

// ────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────

async function main() {
  const xlsxPath = process.argv[2];
  const COMMIT = process.argv.includes('--commit');
  if (!xlsxPath) {
    console.error('Usage: node import-coaches-spreadsheet.js <xlsx-path> [--commit]');
    process.exit(1);
  }
  if (!fs.existsSync(xlsxPath)) {
    console.error('File not found:', xlsxPath);
    process.exit(1);
  }

  console.log(`Mode: ${COMMIT ? 'COMMIT' : 'DRY RUN'}`);
  console.log(`Source: ${xlsxPath}\n`);

  const sheet = parseSpreadsheet(xlsxPath);
  console.log(`Parsed ${sheet.length} unique coaches`);
  console.log(`  active:  ${sheet.filter(c => !c.removed).length}`);
  console.log(`  removed: ${sheet.filter(c => c.removed).length}\n`);

  const client = new Client({ connectionString: loadDbUrl(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    const programs = (await client.query('SELECT id, school_name FROM programs')).rows;
    const schoolLookup = buildSchoolLookup(programs);
    const coachesInDb = (await client.query(
      'SELECT id, cc_source_key, rml_source_key, program_id, first_name, last_name, title, email, phone, twitter_handle, is_active FROM coaches'
    )).rows;
    const protectedCount = coachesInDb.filter(isProtected).length;
    console.log(`Protected rows (skipped by import): ${protectedCount}`);

    // Index protected rows by (program_id, lower(first), lower(last)) so upserts can skip them too
    const protectedByNameKey = new Set();
    for (const c of coachesInDb) {
      if (isProtected(c)) {
        protectedByNameKey.add(`${c.program_id}::${c.first_name.toLowerCase()}::${c.last_name.toLowerCase()}`);
      }
    }
    const byKey = new Map(coachesInDb.filter(c => c.cc_source_key).map(c => [c.cc_source_key, c]));

    // Bucket each spreadsheet row
    const deactivations = [];
    const silentDrops = [];
    const threadProtectedDrops = [];
    const updates = [];
    const upserts = [];
    const missingPrograms = [];

    let skippedProtected = 0;
    for (const s of sheet) {
      if (s.removed) {
        const db = byKey.get(s.cc_source_key);
        if (db && db.is_active) {
          if (isProtected(db)) { skippedProtected++; continue; }
          deactivations.push(db);
        }
        continue;
      }
      const programId = schoolLookup.get(s.school.trim().toLowerCase());
      if (!programId) { missingPrograms.push(s); continue; }

      const db = byKey.get(s.cc_source_key);
      if (db) {
        if (isProtected(db)) { skippedProtected++; continue; }
        const sheetRow = { ...s, program_id: programId };
        if (fieldsDiffer(db, sheetRow)) updates.push({ db, sheet: sheetRow });
      } else {
        // Upsert would ON CONFLICT match by (program, first, last) — don't let it overwrite a protected row
        const nameKey = `${programId}::${s.first_name.toLowerCase()}::${s.last_name.toLowerCase()}`;
        if (protectedByNameKey.has(nameKey)) { skippedProtected++; continue; }
        upserts.push({ ...s, program_id: programId });
      }
    }
    console.log(`Protected skips this run: ${skippedProtected}`);

    // Silent-drop detection: coaches active in DB with a cc_source_key, at a program
    // represented by ≥1 active spreadsheet row, whose key isn't in the spreadsheet's active set.
    // Source list is canonical — absence = no longer on staff. BUT: never deactivate coaches
    // who have email activity (protect ongoing threads — Paul's hard rule).
    const activeSheetKeys = new Set(sheet.filter(s => !s.removed).map(s => s.cc_source_key));
    const coveredPrograms = new Set();
    for (const s of sheet) {
      if (s.removed) continue;
      const id = schoolLookup.get(s.school.trim().toLowerCase());
      if (id) coveredPrograms.add(id);
    }
    const silentCandidates = coachesInDb.filter(c =>
      c.is_active
      && c.cc_source_key
      && coveredPrograms.has(c.program_id)
      && !activeSheetKeys.has(c.cc_source_key)
      && !isProtected(c)
    );
    if (silentCandidates.length) {
      const ids = silentCandidates.map(c => c.id);
      const r1 = (await client.query(`SELECT DISTINCT coach_id FROM email_sends WHERE coach_id = ANY($1)`, [ids])).rows;
      const r2 = (await client.query(`SELECT DISTINCT coach_id FROM filed_emails WHERE coach_id = ANY($1)`, [ids])).rows;
      const withThreads = new Set([...r1, ...r2].map(r => r.coach_id));
      for (const c of silentCandidates) {
        if (withThreads.has(c.id)) threadProtectedDrops.push(c);
        else silentDrops.push(c);
      }
    }

    console.log('── Planned changes ──');
    console.log(`  deactivations (explicit Removed):  ${deactivations.length}`);
    console.log(`  silent-drop deactivations:         ${silentDrops.length}`);
    console.log(`  thread-protected (kept active):    ${threadProtectedDrops.length}`);
    console.log(`  updates:                           ${updates.length}`);
    console.log(`  upserts:                           ${upserts.length}  (inserts OR updates-by-name)`);
    console.log(`  MISSING progs:                     ${missingPrograms.length}`);
    if (silentDrops.length) {
      console.log('\n  Sample silent drops:');
      silentDrops.slice(0, 10).forEach(c => console.log(`    ${c.cc_source_key}  ${c.first_name} ${c.last_name}`));
    }
    if (threadProtectedDrops.length) {
      console.log('\n  Kept due to active threads:');
      threadProtectedDrops.slice(0, 10).forEach(c => console.log(`    ${c.cc_source_key}  ${c.first_name} ${c.last_name}  (${c.email || 'no email'})`));
    }
    if (missingPrograms.length) {
      const bySchool = new Map();
      for (const c of missingPrograms) bySchool.set(c.school, (bySchool.get(c.school) || 0) + 1);
      console.log('    Missing schools (add to SCHOOL_ALIASES or INSERT into programs):');
      for (const [s, n] of bySchool) console.log(`      ${n}× ${s}`);
      fs.writeFileSync(
        path.join(path.dirname(xlsxPath), 'missing_programs.json'),
        JSON.stringify(missingPrograms, null, 2)
      );
    }
    console.log('');

    if (!COMMIT) {
      console.log('DRY RUN — no changes made. Re-run with --commit to apply.');
      return;
    }
    if (missingPrograms.length) {
      console.log('Refusing to commit while MISSING programs > 0. Fix aliases/programs first.');
      process.exit(2);
    }

    await client.query('BEGIN');
    let deactivated = 0, updated = 0, inserted = 0, reUpdated = 0, failed = [];

    for (const db of [...deactivations, ...silentDrops]) {
      await client.query('SAVEPOINT s');
      try {
        await client.query(
          `UPDATE coaches SET is_active = false, updated_at = NOW() WHERE id = $1`,
          [db.id]
        );
        await client.query('RELEASE SAVEPOINT s');
        deactivated++;
      } catch (e) {
        await client.query('ROLLBACK TO SAVEPOINT s');
        failed.push({ op: 'deactivate', id: db.id, err: e.message });
      }
    }

    for (const { db, sheet: s } of updates) {
      await client.query('SAVEPOINT s');
      try {
        await client.query(
          `UPDATE coaches SET
             first_name = $1, last_name = $2, title = $3,
             email = $4, phone = $5, twitter_handle = $6,
             is_active = true, updated_at = NOW()
           WHERE id = $7`,
          [s.first_name, s.last_name, s.title, s.email, s.phone, s.twitter_handle, db.id]
        );
        await client.query('RELEASE SAVEPOINT s');
        updated++;
      } catch (e) {
        await client.query('ROLLBACK TO SAVEPOINT s');
        failed.push({ op: 'update', key: db.cc_source_key, err: e.message });
      }
    }

    for (const s of upserts) {
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
          [s.program_id, s.first_name, s.last_name, s.title, s.email, s.phone, s.twitter_handle, true, s.cc_source_key]
        );
        await client.query('RELEASE SAVEPOINT s');
        if (res.rows[0].inserted) inserted++; else reUpdated++;
      } catch (e) {
        await client.query('ROLLBACK TO SAVEPOINT s');
        failed.push({ op: 'upsert', key: s.cc_source_key, err: e.message });
      }
    }

    if (failed.length === 0) {
      await client.query('COMMIT');
      console.log(`\n✅ COMMIT`);
      console.log(`  deactivated:        ${deactivated}`);
      console.log(`  updated (by key):   ${updated}`);
      console.log(`  inserted:           ${inserted}`);
      console.log(`  updated (by name):  ${reUpdated}`);
    } else {
      await client.query('ROLLBACK');
      console.log(`\n❌ ROLLBACK — ${failed.length} failures`);
      fs.writeFileSync(
        path.join(path.dirname(xlsxPath), 'import_failures.json'),
        JSON.stringify(failed, null, 2)
      );
      const byErr = {};
      for (const f of failed) { const k = f.err.slice(0, 80); byErr[k] = (byErr[k] || 0) + 1; }
      for (const [k, n] of Object.entries(byErr).sort((a, b) => b[1] - a[1])) console.log(`  ${n}× ${k}`);
    }
  } finally {
    await client.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
