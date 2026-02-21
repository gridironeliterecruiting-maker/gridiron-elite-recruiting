#!/usr/bin/env node
/**
 * sync-coaches.js — Read RML coach data from JSON and upsert into Supabase.
 *
 * Usage:
 *   node sync-coaches.js                  # full sync
 *   node sync-coaches.js --dry-run        # preview changes without writing
 *   node sync-coaches.js --file path.json # use a different input file
 *
 * Requires DATABASE_URL in .env (or environment).
 */

const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const DRY_RUN = process.argv.includes('--dry-run');
const FILE_FLAG = process.argv.indexOf('--file');
const INPUT_FILE = FILE_FLAG !== -1
  ? path.resolve(process.argv[FILE_FLAG + 1])
  : path.resolve(__dirname, '..', 'data', 'rml_all_coaches.json');

const BATCH_SIZE = 500;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ---------------------------------------------------------------------------
// Division mapping: RML division string → DB enum value
// ---------------------------------------------------------------------------
const DIVISION_MAP = {
  'NCAA D1 FBS': 'FBS',
  'NCAA D1 FCS': 'FCS',
  'D2': 'DII',
  'D3': 'DIII',
  'NAIA': 'NAIA',
  // All JC variants map to JUCO
  'JC': 'JUCO',
  'JC-D1': 'JUCO',
  'JC-CCCAA': 'JUCO',
};

function mapDivision(rmlDivision) {
  if (!rmlDivision) return null;
  // Exact match first
  if (DIVISION_MAP[rmlDivision]) return DIVISION_MAP[rmlDivision];
  // All "JC-CCCAA - *" variants → JUCO
  if (rmlDivision.startsWith('JC')) return 'JUCO';
  console.warn(`  [WARN] Unknown division: "${rmlDivision}"`);
  return null;
}

// ---------------------------------------------------------------------------
// Name parsing: "Keith Patterson" → { first: "Keith", last: "Patterson" }
// Handles: "D.J. Williams", "John Smith Jr.", "Robert Lee III",
//          "Smith, John" (comma-separated), single names
// ---------------------------------------------------------------------------
const SUFFIXES = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v']);

function parseName(fullName) {
  if (!fullName || !fullName.trim()) return { first: '', last: '' };

  let name = fullName.trim();

  // Handle "Last, First" format
  if (name.includes(',')) {
    const parts = name.split(',').map(s => s.trim());
    // Check if the part after comma is a suffix
    if (parts.length === 2 && SUFFIXES.has(parts[1].toLowerCase())) {
      // "Smith, Jr." — treat whole thing as last name
      return { first: '', last: name };
    }
    // "Smith, John" → first: John, last: Smith
    if (parts.length >= 2) {
      return { first: parts[1], last: parts[0] };
    }
  }

  const words = name.split(/\s+/);

  // Strip trailing suffixes
  while (words.length > 1 && SUFFIXES.has(words[words.length - 1].toLowerCase())) {
    words.pop();
  }

  if (words.length === 0) return { first: '', last: '' };
  if (words.length === 1) return { first: '', last: words[0] };

  // First word(s) = first name, last word = last name
  const last = words.pop();
  const first = words.join(' ');
  return { first, last };
}

// ---------------------------------------------------------------------------
// School name normalization for fuzzy matching
// ---------------------------------------------------------------------------
function normalizeSchoolName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9\s&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Build a short name from a formal name for matching.
 * "University of Iowa" → "iowa"
 * "Iowa State University" → "iowa state"
 * "Clemson University" → "clemson"
 */
function toShortName(formalName) {
  let s = formalName;
  // Strip "University of " prefix
  s = s.replace(/^University of\s+/i, '');
  // Strip " University" suffix
  s = s.replace(/\s+University$/i, '');
  // Strip " College" suffix
  s = s.replace(/\s+College$/i, '');
  // Strip " Institute" suffix
  s = s.replace(/\s+Institute$/i, '');
  // Strip location qualifiers after dash
  s = s.replace(/\s*-\s*[A-Z].*$/, '');
  return normalizeSchoolName(s);
}

// ---------------------------------------------------------------------------
// RML source key: composite key for deduplication
// ---------------------------------------------------------------------------
function makeSourceKey(coach) {
  const school = normalizeSchoolName(coach.school);
  const name = normalizeSchoolName(coach.name);
  return `${school}::${name}`;
}

// ---------------------------------------------------------------------------
// Main sync logic
// ---------------------------------------------------------------------------
async function main() {
  console.log(`\n=== Gridiron Elite Coach Sync ===`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  console.log(`Input: ${INPUT_FILE}\n`);

  // Load data
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`File not found: ${INPUT_FILE}`);
    process.exit(1);
  }
  const rmlCoaches = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
  console.log(`Loaded ${rmlCoaches.length} coaches from JSON`);

  // Load school name mapping overrides
  const mappingFile = path.resolve(__dirname, '..', 'data', 'school-name-mapping.json');
  let schoolNameOverrides = {};
  if (fs.existsSync(mappingFile)) {
    schoolNameOverrides = JSON.parse(fs.readFileSync(mappingFile, 'utf8'));
    delete schoolNameOverrides._comment;
    console.log(`Loaded ${Object.keys(schoolNameOverrides).length} school name overrides`);
  }

  // Group RML data by school
  const schoolGroups = new Map();
  for (const coach of rmlCoaches) {
    if (!coach.school) continue;
    if (!schoolGroups.has(coach.school)) {
      schoolGroups.set(coach.school, []);
    }
    schoolGroups.get(coach.school).push(coach);
  }
  console.log(`Found ${schoolGroups.size} unique schools\n`);

  const client = await pool.connect();

  try {
    // -------------------------------------------------------------------
    // Load existing programs from DB
    // -------------------------------------------------------------------
    const { rows: existingPrograms } = await client.query(
      'SELECT id, school_name, division, conference, state, rml_school_name FROM programs ORDER BY school_name'
    );
    console.log(`Existing programs in DB: ${existingPrograms.length}`);

    // Build multiple lookup maps for programs
    const programByExactName = new Map();      // school_name → program
    const programByRmlName = new Map();        // rml_school_name → program
    const programByNormalized = new Map();     // normalized school_name → program
    const programByShortName = new Map();      // short name → program

    for (const prog of existingPrograms) {
      programByExactName.set(prog.school_name.toLowerCase(), prog);
      if (prog.rml_school_name) {
        programByRmlName.set(prog.rml_school_name.toLowerCase(), prog);
      }
      programByNormalized.set(normalizeSchoolName(prog.school_name), prog);
      programByShortName.set(toShortName(prog.school_name), prog);
    }

    // -------------------------------------------------------------------
    // Load existing coaches from DB
    // -------------------------------------------------------------------
    const { rows: existingCoaches } = await client.query(
      'SELECT id, program_id, first_name, last_name, email, rml_source_key FROM coaches'
    );
    console.log(`Existing coaches in DB: ${existingCoaches.length}\n`);

    // Build coach lookup maps
    const coachBySourceKey = new Map();                      // rml_source_key → coach
    const coachByProgramEmail = new Map();                   // program_id::email → coach
    const coachByProgramName = new Map();                    // program_id::first::last → coach
    const coachByEmail = new Map();                          // email → coach (for school transfers)

    for (const c of existingCoaches) {
      if (c.rml_source_key) coachBySourceKey.set(c.rml_source_key, c);
      if (c.email) {
        const emailKey = `${c.program_id}::${c.email.toLowerCase()}`;
        coachByProgramEmail.set(emailKey, c);
        coachByEmail.set(c.email.toLowerCase(), c);
      }
      const nameKey = `${c.program_id}::${c.first_name.toLowerCase()}::${c.last_name.toLowerCase()}`;
      coachByProgramName.set(nameKey, c);
    }

    // -------------------------------------------------------------------
    // Process schools and coaches
    // -------------------------------------------------------------------
    const stats = {
      programsCreated: 0,
      programsUpdated: 0,
      programsSkipped: 0,
      coachesCreated: 0,
      coachesUpdated: 0,
      coachesSkipped: 0,
      coachesMoved: 0,
      coachesDeactivated: 0,
      divisionSkipped: 0,
      unmatchedSchools: [],
    };

    // Track which coach IDs we've seen in this sync (for deactivation)
    const seenCoachIds = new Set();

    // Process in batches by school
    const schoolEntries = [...schoolGroups.entries()];

    if (!DRY_RUN) {
      await client.query('BEGIN');
    }

    for (let i = 0; i < schoolEntries.length; i++) {
      const [rmlSchoolName, coaches] = schoolEntries[i];
      const sampleCoach = coaches[0];

      // Map division
      const division = mapDivision(sampleCoach.division);
      if (!division) {
        stats.divisionSkipped++;
        continue;
      }

      // -------------------------------------------------------------------
      // Find or create program
      // -------------------------------------------------------------------
      let program = null;

      // 1. Check if we've already matched this RML name before
      program = programByRmlName.get(rmlSchoolName.toLowerCase());

      // 2. Check school name override mapping
      if (!program && schoolNameOverrides[rmlSchoolName]) {
        const dbName = schoolNameOverrides[rmlSchoolName];
        program = programByExactName.get(dbName.toLowerCase());
      }

      // 3. Exact match on school_name
      if (!program) {
        program = programByExactName.get(rmlSchoolName.toLowerCase());
      }

      // 4. Normalized match
      if (!program) {
        program = programByNormalized.get(normalizeSchoolName(rmlSchoolName));
      }

      // 5. Short name match (strip "University of", etc.)
      if (!program) {
        const short = toShortName(rmlSchoolName);
        if (short) program = programByShortName.get(short);
      }

      if (program) {
        // Update program with RML metadata if needed
        const updates = [];
        const values = [];
        let paramIdx = 1;

        if (program.rml_school_name !== rmlSchoolName) {
          updates.push(`rml_school_name = $${paramIdx++}`);
          values.push(rmlSchoolName);
        }
        if (sampleCoach.conference && program.conference !== sampleCoach.conference) {
          updates.push(`conference = $${paramIdx++}`);
          values.push(sampleCoach.conference);
        }
        if (sampleCoach.state && program.state !== sampleCoach.state) {
          updates.push(`state = $${paramIdx++}`);
          values.push(sampleCoach.state);
        }

        if (updates.length > 0 && !DRY_RUN) {
          values.push(program.id);
          await client.query(
            `UPDATE programs SET ${updates.join(', ')} WHERE id = $${paramIdx}`,
            values
          );
          stats.programsUpdated++;
        } else if (updates.length > 0) {
          stats.programsUpdated++;
        } else {
          stats.programsSkipped++;
        }
      } else {
        // Create new program
        if (!DRY_RUN) {
          const { rows } = await client.query(
            `INSERT INTO programs (school_name, division, conference, state, rml_school_name)
             VALUES ($1, $2::division, $3, $4, $5)
             RETURNING id, school_name, division, conference, state, rml_school_name`,
            [rmlSchoolName, division, sampleCoach.conference, sampleCoach.state, rmlSchoolName]
          );
          program = rows[0];
          // Add to lookup maps
          programByExactName.set(program.school_name.toLowerCase(), program);
          programByRmlName.set(rmlSchoolName.toLowerCase(), program);
          programByNormalized.set(normalizeSchoolName(program.school_name), program);
          programByShortName.set(toShortName(program.school_name), program);
        } else {
          // In dry run, create a fake program for tracking
          program = { id: `NEW-${rmlSchoolName}`, school_name: rmlSchoolName };
          stats.unmatchedSchools.push(rmlSchoolName);
        }
        stats.programsCreated++;
      }

      // -------------------------------------------------------------------
      // Process coaches for this program
      // -------------------------------------------------------------------
      for (const rmlCoach of coaches) {
        const sourceKey = makeSourceKey(rmlCoach);
        const { first, last } = parseName(rmlCoach.name);
        const email = rmlCoach.email ? rmlCoach.email.trim().toLowerCase() : null;
        const title = rmlCoach.position || null;
        const phone = rmlCoach.phone || null;
        const twitterHandle = rmlCoach.twitter ? rmlCoach.twitter.replace(/^@/, '') : null;
        const dmOpen = rmlCoach.dm_open === 'Yes';

        if (!last && !first) {
          stats.coachesSkipped++;
          continue;
        }

        let existingCoach = null;

        // Match priority:
        // 1. Same source key (strongest match)
        existingCoach = coachBySourceKey.get(sourceKey);

        // 2. Same program + same email
        if (!existingCoach && email && program.id) {
          const key = `${program.id}::${email}`;
          existingCoach = coachByProgramEmail.get(key);
        }

        // 3. Same program + same name
        if (!existingCoach && program.id) {
          const key = `${program.id}::${first.toLowerCase()}::${last.toLowerCase()}`;
          existingCoach = coachByProgramName.get(key);
        }

        // 4. Same email, different program (coach moved schools)
        let coachMoved = false;
        if (!existingCoach && email) {
          const byEmail = coachByEmail.get(email);
          if (byEmail && byEmail.program_id !== program.id) {
            existingCoach = byEmail;
            coachMoved = true;
          }
        }

        if (existingCoach) {
          seenCoachIds.add(existingCoach.id);

          // Update existing coach
          if (!DRY_RUN) {
            const updateFields = [];
            const updateValues = [];
            let idx = 1;

            if (coachMoved) {
              updateFields.push(`program_id = $${idx++}`);
              updateValues.push(program.id);
              stats.coachesMoved++;
            }
            // Don't update first_name/last_name — unique constraint
            // (program_id, first_name, last_name) can cause conflicts
            if (title) {
              updateFields.push(`title = $${idx++}`);
              updateValues.push(title);
            }
            if (email) {
              updateFields.push(`email = $${idx++}`);
              updateValues.push(email);
            }
            if (phone) {
              updateFields.push(`phone = $${idx++}`);
              updateValues.push(phone);
            }
            if (twitterHandle !== undefined) {
              updateFields.push(`twitter_handle = $${idx++}`);
              updateValues.push(twitterHandle);
            }
            updateFields.push(`twitter_dm_open = $${idx++}`);
            updateValues.push(dmOpen);
            updateFields.push(`rml_source_key = $${idx++}`);
            updateValues.push(sourceKey);
            updateFields.push(`is_active = $${idx++}`);
            updateValues.push(true);

            if (updateFields.length > 0) {
              updateValues.push(existingCoach.id);
              await client.query(
                `UPDATE coaches SET ${updateFields.join(', ')} WHERE id = $${idx}`,
                updateValues
              );
            }
          } else if (coachMoved) {
            stats.coachesMoved++;
          }
          stats.coachesUpdated++;
        } else {
          // Insert new coach (ON CONFLICT handles "second email" dupes in RML data)
          if (!DRY_RUN) {
            const { rows } = await client.query(
              `INSERT INTO coaches (program_id, first_name, last_name, title, email, phone, twitter_handle, twitter_dm_open, rml_source_key, is_active)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)
               ON CONFLICT (program_id, first_name, last_name) DO UPDATE SET
                 title = COALESCE(EXCLUDED.title, coaches.title),
                 email = COALESCE(EXCLUDED.email, coaches.email),
                 phone = COALESCE(EXCLUDED.phone, coaches.phone),
                 twitter_handle = COALESCE(EXCLUDED.twitter_handle, coaches.twitter_handle),
                 twitter_dm_open = EXCLUDED.twitter_dm_open,
                 rml_source_key = EXCLUDED.rml_source_key,
                 is_active = TRUE
               RETURNING id`,
              [program.id, first || '', last, title, email, phone, twitterHandle, dmOpen, sourceKey]
            );
            seenCoachIds.add(rows[0].id);

            // Add to lookup maps for dedup within this run
            if (email) {
              coachByProgramEmail.set(`${program.id}::${email}`, rows[0]);
              coachByEmail.set(email, rows[0]);
            }
            coachBySourceKey.set(sourceKey, rows[0]);
          }
          stats.coachesCreated++;
        }
      }

      // Progress
      if ((i + 1) % 100 === 0) {
        console.log(`  Processed ${i + 1}/${schoolEntries.length} schools...`);
      }
    }

    // -------------------------------------------------------------------
    // Deactivate coaches not seen in this sync
    // -------------------------------------------------------------------
    if (!DRY_RUN && seenCoachIds.size > 0) {
      // Only deactivate coaches that have an rml_source_key (were previously synced)
      // and were not seen in this run
      const { rowCount } = await client.query(
        `UPDATE coaches SET is_active = FALSE
         WHERE rml_source_key IS NOT NULL
           AND is_active = TRUE
           AND id != ALL($1::uuid[])`,
        [[...seenCoachIds]]
      );
      stats.coachesDeactivated = rowCount;
    } else if (DRY_RUN) {
      // Estimate deactivations
      const rmlKeyedCoaches = existingCoaches.filter(c => c.rml_source_key);
      stats.coachesDeactivated = rmlKeyedCoaches.filter(c => !seenCoachIds.has(c.id)).length;
    }

    if (!DRY_RUN) {
      await client.query('COMMIT');
      console.log(`\nTransaction committed.`);
    }

    // -------------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------------
    console.log(`\n=== Sync Summary ===`);
    console.log(`Programs: ${stats.programsCreated} created, ${stats.programsUpdated} updated, ${stats.programsSkipped} unchanged`);
    console.log(`Coaches:  ${stats.coachesCreated} created, ${stats.coachesUpdated} updated, ${stats.coachesSkipped} skipped`);
    console.log(`          ${stats.coachesMoved} moved schools, ${stats.coachesDeactivated} deactivated`);
    if (stats.divisionSkipped > 0) {
      console.log(`          ${stats.divisionSkipped} schools skipped (unknown division)`);
    }

    if (DRY_RUN && stats.unmatchedSchools.length > 0) {
      console.log(`\n=== Unmatched Schools (would create new) ===`);
      stats.unmatchedSchools.sort().forEach(s => console.log(`  ${s}`));
      console.log(`\nAdd overrides to data/school-name-mapping.json to map these to existing programs.`);
    }

    // Final counts
    if (!DRY_RUN) {
      const { rows: [pc] } = await client.query('SELECT count(*) FROM programs');
      const { rows: [cc] } = await client.query('SELECT count(*) FROM coaches WHERE is_active = TRUE');
      const { rows: [ci] } = await client.query('SELECT count(*) FROM coaches WHERE is_active = FALSE');
      console.log(`\nDB totals: ${pc.count} programs, ${cc.count} active coaches, ${ci.count} inactive coaches`);
    }

  } catch (err) {
    if (!DRY_RUN) {
      await client.query('ROLLBACK');
      console.error('Transaction rolled back.');
    }
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('\nFATAL:', err.message);
  console.error(err.stack);
  process.exit(1);
});
