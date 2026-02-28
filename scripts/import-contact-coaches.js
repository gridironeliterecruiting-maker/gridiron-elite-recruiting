'use strict'

/**
 * import-contact-coaches.js
 *
 * Imports the "Contact College Coaches" Excel database into Supabase.
 *
 * UUID preservation strategy (in order of confidence):
 *   1. cc_source_key match  — stable per-coach ID from the source (best)
 *   2. Email match          — reliable across name/school changes
 *   3. Program + name match — fallback for first-time import from old RML data
 *   4. No match             — insert new coach, log to review report
 *
 * Coaches in matched programs that are NOT in the new source → is_active = false.
 * Programs not covered by the source at all → left completely untouched.
 *
 * Usage:
 *   node import-contact-coaches.js [path-to-xlsx] [options]
 *
 * Options:
 *   --dry-run          Preview changes without writing to DB
 *   --sheet=FBS        Process only one sheet (FBS|FCS|DII|DIII|JuCo|NAIA)
 *   --skip-inactive    Do not deactivate coaches missing from source
 */

const XLSX    = require('xlsx')
const { Pool } = require('pg')
const fs      = require('fs')
const path    = require('path')
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })

// ─── Column indices (0-based) ─────────────────────────────────────────────────
const C = {
  CONFERENCE:      0,
  STATE:           1,
  DIVISION:        2,
  UNIQUE_ID:       3,  // stable per-coach key, e.g. "DI114386"
  SPORT_CODE:      4,
  ADDED_FLAG:      5,  // x=new | j=job change | e=email change | #=phone change
  REMOVED_FLAG:    6,  // y = this person left their position
  SCHOOL_FULL:     7,  // e.g. "Auburn University"
  FIRST_NAME:      8,
  LAST_NAME:       9,
  TITLE:           10,
  EMAIL:           11,
  PHONE:           12,
  LANDING_PAGE:    13,
  TWITTER_IND:     14, // individual's Twitter/X (full URL)
  TWITTER_TEAM:    15, // team Twitter (full URL)
  FACEBOOK_IND:    16,
  FACEBOOK_TEAM:   17,
  INSTAGRAM_IND:   18,
  INSTAGRAM_TEAM:  19,
  QUESTIONNAIRE:   20,
  SCHOOL_SHORT:    21, // e.g. "Auburn"
  STATE2:          22,
  CITY:            23,
}

// Header row is index 5; data starts at index 6 (0-based)
const DATA_START_ROW = 6

// Sheet name → our division enum
const SHEET_DIVISION = {
  FBS:  'FBS',
  FCS:  'FCS',
  DII:  'DII',
  DIII: 'DIII',
  JuCo: 'JUCO',
  NAIA: 'NAIA',
}

// ─── Known school name overrides ──────────────────────────────────────────────
// Key: lowercased source school name (full or short)
// Value: exact school_name as stored in our programs table
// Add entries here after reviewing the import-review-*.txt report.
const SCHOOL_OVERRIDES = {
  // Common abbreviations
  'lsu':                             'Louisiana State University',
  'louisiana state':                 'Louisiana State University',
  'uab':                             'University of Alabama at Birmingham',
  'byu':                             'Brigham Young University',
  'usc':                             'University of Southern California',
  'ucf':                             'University of Central Florida',
  'fiu':                             'Florida International University',
  'fau':                             'Florida Atlantic University',
  'utsa':                            'University of Texas at San Antonio',
  'utep':                            'University of Texas at El Paso',
  'unt':                             'University of North Texas',
  'unlv':                            'University of Nevada, Las Vegas',
  'smu':                             'Southern Methodist University',
  'tcu':                             'Texas Christian University',
  'ole miss':                        'University of Mississippi',
  'miami (fl)':                      'University of Miami',
  'miami (oh)':                      'Miami University',
  'ohio':                            'Ohio University',
  'pitt':                            'University of Pittsburgh',
  'nc state':                        'North Carolina State University',
  'unc':                             'University of North Carolina at Chapel Hill',
  'uconn':                           'University of Connecticut',
  'umass':                           'University of Massachusetts Amherst',
  'middle tennessee':                'Middle Tennessee State University',
  'old dominion':                    'Old Dominion University',
  'ut':                              'University of Tennessee',
  'ut martin':                       'University of Tennessee at Martin',
  'bowling green':                   'Bowling Green State University',
  'central michigan':                'Central Michigan University',
  'eastern michigan':                'Eastern Michigan University',
  'western michigan':                'Western Michigan University',
  'northern illinois':               'Northern Illinois University',
  'ball state':                      'Ball State University',
  'kent state':                      'Kent State University',
  // NAIA name variants
  'montana technological university': 'Montana Tech of the University of Montana',
  'montana tech':                     'Montana Tech of the University of Montana',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function str(v) {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

function normalizeSchoolName(name) {
  return name
    .toLowerCase()
    .replace(/\bthe\s+/g, '')
    .replace(/\s*\([^)]*\)/g, '')    // strip parentheticals: (FL), (OH)
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractHandle(url, ...domains) {
  if (!url || url === '-' || url === '') return null
  const domainPattern = domains.join('|')
  const pattern = new RegExp(`(?:${domainPattern})\\/([^\\/?#&]+)`, 'i')
  const match = String(url).match(pattern)
  if (!match) return null
  return match[1].replace(/\/$/, '').replace(/^@/, '') || null
}

function extractTwitterHandle(url) {
  return extractHandle(url, 'twitter\\.com', 'x\\.com')
}
function extractFacebookHandle(url) {
  return extractHandle(url, 'facebook\\.com')
}
function extractInstagramHandle(url) {
  return extractHandle(url, 'instagram\\.com')
}

function cleanPhone(raw) {
  if (!raw) return null
  const s = String(raw).trim()
  if (s.replace(/\D/g, '').length < 7) return null
  return s
}

function cleanEmail(raw) {
  const s = str(raw).toLowerCase()
  return s.includes('@') ? s : null
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args        = process.argv.slice(2)
  const xlsxPath    = args.find(a => !a.startsWith('--'))
    || 'C:/Users/Paul Kongshaug/Downloads/Football-coaches-database-December-2025.xlsx'
  const dryRun      = args.includes('--dry-run')
  const skipInactive = args.includes('--skip-inactive')
  const onlySheet   = args.find(a => a.startsWith('--sheet='))?.split('=')[1]

  console.log(`\n${'='.repeat(64)}`)
  console.log('  Contact Coaches Import')
  console.log(`  File:  ${path.basename(xlsxPath)}`)
  console.log(`  Mode:  ${dryRun ? 'DRY RUN — no DB changes will be made' : 'LIVE'}`)
  if (onlySheet) console.log(`  Sheet: ${onlySheet} only`)
  if (skipInactive) console.log(`  Deactivation: skipped`)
  console.log(`${'='.repeat(64)}\n`)

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  try {
    // ── Load all programs from DB ────────────────────────────────────────────
    console.log('Loading programs from DB...')
    const { rows: programs } = await pool.query(
      `SELECT id, school_name, rml_school_name, division, city, state FROM programs`
    )

    // Build lookup: normalizedName → program
    const programIndex = new Map()
    for (const p of programs) {
      const names = [p.school_name, p.rml_school_name].filter(Boolean)
      for (const name of names) {
        const key = normalizeSchoolName(name)
        if (!programIndex.has(key)) programIndex.set(key, p)
      }
    }
    // Also index by city (fallback for short name clashes)
    const programByCity = new Map()
    for (const p of programs) {
      if (p.city) {
        const key = p.city.toLowerCase()
        if (!programByCity.has(key)) programByCity.set(key, [])
        programByCity.get(key).push(p)
      }
    }

    // ── Load all existing coaches from DB ────────────────────────────────────
    console.log('Loading existing coaches from DB...')
    const { rows: existingCoaches } = await pool.query(
      `SELECT id, program_id, first_name, last_name, email, cc_source_key, is_active,
              twitter_handle, twitter_dm_open
       FROM coaches`
    )

    const coachBySourceKey        = new Map()  // cc_source_key → coach
    const coachByProgramAndEmail  = new Map()  // `programId|email` → coach (same-program preferred)
    const coachByEmail            = new Map()  // email → coach (any program, fallback)
    const coachByProgramAndName   = new Map()  // `programId|first|last` → coach

    for (const c of existingCoaches) {
      if (c.cc_source_key) coachBySourceKey.set(c.cc_source_key, c)
      if (c.email) {
        const emailLow = c.email.toLowerCase()
        coachByEmail.set(emailLow, c)
        const progEmailKey = `${c.program_id}|${emailLow}`
        coachByProgramAndEmail.set(progEmailKey, c)
      }
      const nameKey = `${c.program_id}|${(c.first_name || '').toLowerCase()}|${(c.last_name || '').toLowerCase()}`
      coachByProgramAndName.set(nameKey, c)
    }

    // ── Parse Excel ──────────────────────────────────────────────────────────
    console.log('Parsing Excel file...\n')
    const wb = XLSX.readFile(xlsxPath)
    const sheetsToProcess = onlySheet
      ? [onlySheet]
      : Object.keys(SHEET_DIVISION)

    // ── Tracking ─────────────────────────────────────────────────────────────
    const stats = {
      totalRows:              0,
      skippedRemoved:         0,
      skippedNoName:          0,
      skippedNoProgram:       0,
      programMatched:         0,
      coachMatchedBySourceKey: 0,
      coachMatchedByEmail:    0,
      coachMatchedByName:     0,
      coachInserted:          0,
      coachUpdated:           0,
      deactivated:            0,
      errors:                 0,
    }

    const reviewLines       = []
    const processedCoachIds = new Set()    // UUIDs we touched
    const processedProgIds  = new Set()    // programs covered by source

    // ── Process each sheet ───────────────────────────────────────────────────
    for (const sheetName of sheetsToProcess) {
      if (!wb.SheetNames.includes(sheetName)) {
        console.log(`  Sheet "${sheetName}" not found — skipping`)
        continue
      }

      const ws   = wb.Sheets[sheetName]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
      const dataRows = rows.slice(DATA_START_ROW).filter(r => r && r.some(v => v !== null))

      console.log(`Processing ${sheetName} (${dataRows.length.toLocaleString()} rows)...`)
      stats.totalRows += dataRows.length

      const teamTwitterByProgram = new Map()

      for (const row of dataRows) {
        // ── Removed coaches ────────────────────────────────────────────────
        if (str(row[C.REMOVED_FLAG]).toLowerCase() === 'y') {
          stats.skippedRemoved++
          // If we already know their source key, deactivate in DB
          const sk = str(row[C.UNIQUE_ID])
          if (sk && coachBySourceKey.has(sk)) {
            const existing = coachBySourceKey.get(sk)
            if (!dryRun) {
              await pool.query(
                `UPDATE coaches SET is_active = false, updated_at = NOW() WHERE id = $1`,
                [existing.id]
              )
            }
          }
          continue
        }

        const firstName = str(row[C.FIRST_NAME])
        const lastName  = str(row[C.LAST_NAME])
        if (!firstName && !lastName) { stats.skippedNoName++; continue }

        const sourceKey   = str(row[C.UNIQUE_ID]) || null
        const schoolFull  = str(row[C.SCHOOL_FULL])
        const schoolShort = str(row[C.SCHOOL_SHORT])
        const email       = cleanEmail(row[C.EMAIL])
        const phone       = cleanPhone(row[C.PHONE])
        const title       = str(row[C.TITLE]) || null
        const twitterInd  = extractTwitterHandle(str(row[C.TWITTER_IND]))
        const twitterTeam = extractTwitterHandle(str(row[C.TWITTER_TEAM]))
        const fbInd       = extractFacebookHandle(str(row[C.FACEBOOK_IND]))
        const igInd       = extractInstagramHandle(str(row[C.INSTAGRAM_IND]))

        // ── Match program ──────────────────────────────────────────────────
        let program = null

        // 1. Try SCHOOL_OVERRIDES
        const overrideKey  = schoolFull.toLowerCase()
        const shortOverKey = schoolShort.toLowerCase()
        const overrideName = SCHOOL_OVERRIDES[overrideKey]
          || SCHOOL_OVERRIDES[shortOverKey]
          || SCHOOL_OVERRIDES[normalizeSchoolName(schoolFull)]
        if (overrideName) {
          program = programIndex.get(normalizeSchoolName(overrideName))
        }

        // 2. Exact normalized match on full name
        if (!program) {
          program = programIndex.get(normalizeSchoolName(schoolFull))
        }

        // 3. Match on short name
        if (!program && schoolShort) {
          program = programIndex.get(normalizeSchoolName(schoolShort))
        }

        if (!program) {
          stats.skippedNoProgram++
          reviewLines.push(
            `UNMATCHED SCHOOL | ${sheetName} | "${schoolFull}" (short: "${schoolShort}") | ${firstName} ${lastName} | ${title || ''} | ${email || ''}`
          )
          continue
        }

        stats.programMatched++
        processedProgIds.add(program.id)

        // Capture team Twitter (first occurrence per program)
        if (twitterTeam && !teamTwitterByProgram.has(program.id)) {
          teamTwitterByProgram.set(program.id, twitterTeam)
        }

        // ── Match coach ────────────────────────────────────────────────────
        let existing    = null
        let matchMethod = null

        if (sourceKey && coachBySourceKey.has(sourceKey)) {
          existing    = coachBySourceKey.get(sourceKey)
          matchMethod = 'source_key'
        } else {
          const nameKey = `${program.id}|${firstName.toLowerCase()}|${lastName.toLowerCase()}`
          if (coachByProgramAndName.has(nameKey)) {
            // Name match at same program wins over email match — avoids update collisions
            // when the email belongs to a different coach at this school
            existing    = coachByProgramAndName.get(nameKey)
            matchMethod = 'name'
          } else if (email && coachByProgramAndEmail.has(`${program.id}|${email}`)) {
            // Same-program email match (no name conflict exists)
            existing    = coachByProgramAndEmail.get(`${program.id}|${email}`)
            matchMethod = 'email'
          } else if (email && coachByEmail.has(email)) {
            // Cross-program email match: coach transferred schools
            existing    = coachByEmail.get(email)
            matchMethod = 'email'
          }
        }

        try {
          if (existing) {
            // UPDATE — preserve UUID ──────────────────────────────────────
            processedCoachIds.add(existing.id)

            if (matchMethod === 'source_key') stats.coachMatchedBySourceKey++
            else if (matchMethod === 'email') stats.coachMatchedByEmail++
            else                              stats.coachMatchedByName++

            if (!dryRun) {
              await pool.query(`
                UPDATE coaches SET
                  program_id       = $1,
                  first_name       = $2,
                  last_name        = $3,
                  title            = $4,
                  email            = COALESCE($5, email),
                  phone            = $6,
                  twitter_handle   = COALESCE($7, twitter_handle),
                  facebook_handle  = $8,
                  instagram_handle = $9,
                  cc_source_key    = COALESCE($10, cc_source_key),
                  is_active        = true,
                  updated_at       = NOW()
                WHERE id = $11
              `, [
                program.id,
                firstName,
                lastName,
                title,
                email,
                phone,
                twitterInd,
                fbInd,
                igInd,
                sourceKey,
                existing.id,
              ])
            }
            stats.coachUpdated++

          } else {
            // INSERT — new coach ──────────────────────────────────────────
            stats.coachInserted++

            if (!dryRun) {
              const { rows: [inserted] } = await pool.query(`
                INSERT INTO coaches (
                  program_id, first_name, last_name, title, email, phone,
                  twitter_handle, facebook_handle, instagram_handle,
                  cc_source_key, is_active, twitter_dm_open
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,false)
                ON CONFLICT ON CONSTRAINT coaches_program_name_key DO UPDATE SET
                  title            = EXCLUDED.title,
                  email            = COALESCE(EXCLUDED.email, coaches.email),
                  phone            = EXCLUDED.phone,
                  twitter_handle   = COALESCE(EXCLUDED.twitter_handle, coaches.twitter_handle),
                  facebook_handle  = EXCLUDED.facebook_handle,
                  instagram_handle = EXCLUDED.instagram_handle,
                  cc_source_key    = COALESCE(EXCLUDED.cc_source_key, coaches.cc_source_key),
                  is_active        = true,
                  updated_at       = NOW()
                RETURNING id
              `, [
                program.id, firstName, lastName, title,
                email, phone,
                twitterInd, fbInd, igInd,
                sourceKey,
              ])
              processedCoachIds.add(inserted.id)
            }
          }
        } catch (err) {
          stats.errors++
          reviewLines.push(
            `ERROR | ${firstName} ${lastName} @ ${schoolFull} | ${err.message}`
          )
        }
      } // end row loop

      // Update team Twitter on matched programs (only where not already set)
      if (!dryRun) {
        for (const [programId, handle] of teamTwitterByProgram) {
          await pool.query(
            `UPDATE programs SET twitter_handle = $1
             WHERE id = $2 AND (twitter_handle IS NULL OR twitter_handle = '')`,
            [handle, programId]
          )
        }
      }
    } // end sheet loop

    // ── Deactivate coaches in processed programs that weren't in the source ──
    if (!dryRun && !skipInactive && processedProgIds.size > 0) {
      const { rowCount } = await pool.query(`
        UPDATE coaches
        SET is_active = false, updated_at = NOW()
        WHERE program_id = ANY($1::uuid[])
          AND id        != ALL($2::uuid[])
          AND is_active  = true
          AND title      != 'Team Twitter'
      `, [
        Array.from(processedProgIds),
        Array.from(processedCoachIds),
      ])
      stats.deactivated = rowCount
    }

    // ── Write review report ──────────────────────────────────────────────────
    const timestamp  = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const reportPath = path.join(__dirname, `import-review-${timestamp}.txt`)
    if (reviewLines.length > 0) {
      fs.writeFileSync(reportPath, reviewLines.join('\n') + '\n', 'utf8')
    }

    // ── Summary ──────────────────────────────────────────────────────────────
    console.log(`\n${'='.repeat(64)}`)
    console.log('  RESULTS' + (dryRun ? ' (DRY RUN — nothing was written)' : ''))
    console.log(`${'='.repeat(64)}`)
    console.log(`  Total rows processed:        ${stats.totalRows.toLocaleString()}`)
    console.log(`  Skipped (removed/left):      ${stats.skippedRemoved.toLocaleString()}`)
    console.log(`  Skipped (no name):           ${stats.skippedNoName.toLocaleString()}`)
    console.log(`  Skipped (unmatched school):  ${stats.skippedNoProgram.toLocaleString()}`)
    console.log(`  ──────────────────────────────────────────────`)
    console.log(`  Coaches matched by ID:       ${stats.coachMatchedBySourceKey.toLocaleString()}`)
    console.log(`  Coaches matched by email:    ${stats.coachMatchedByEmail.toLocaleString()}`)
    console.log(`  Coaches matched by name:     ${stats.coachMatchedByName.toLocaleString()}`)
    console.log(`  Coaches inserted (new):      ${stats.coachInserted.toLocaleString()}`)
    console.log(`  Coaches updated:             ${stats.coachUpdated.toLocaleString()}`)
    console.log(`  Coaches deactivated:         ${stats.deactivated.toLocaleString()}`)
    console.log(`  Errors:                      ${stats.errors.toLocaleString()}`)
    if (reviewLines.length > 0) {
      console.log(`\n  Review report → ${path.basename(reportPath)}`)
      console.log(`  (${reviewLines.length.toLocaleString()} items need attention)`)
      console.log(`\n  NEXT STEP: Review the report, add any unmatched schools`)
      console.log(`  to SCHOOL_OVERRIDES in this script, then re-run.`)
    } else {
      console.log('\n  No items need review — clean import!')
    }
    console.log()

  } finally {
    await pool.end()
  }
}

main().catch(err => { console.error('\nFatal error:', err.message); process.exit(1) })
