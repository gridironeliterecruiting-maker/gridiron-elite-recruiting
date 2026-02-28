/**
 * Shared merge tag resolution for DM campaigns (client-side preview).
 * Email sending uses resolveEmailMergeTags in gmail.ts with a richer data set.
 *
 * Canonical tag format: ((Tag Name))
 * All tags use explicit prefixes so there is zero ambiguity:
 *   ((Coach Last Name))   — the college coach being contacted
 *   ((Player First Name)) — the athlete being recruited
 *   ((School Name))       — the college / program
 *   ((My First Name))     — the sender (coach campaigns only)
 */

export interface MergeTagData {
  // Recipient (the college coach)
  coachName?: string
  coachFirstName?: string
  // School being contacted
  schoolName?: string
  // Player being recruited
  playerFirstName?: string
  playerLastName?: string
  position?: string
  gradYear?: string
  highSchool?: string
  city?: string
  state?: string
  gpa?: string
  filmLink?: string
  phone?: string
  email?: string
  // Sender (for coach templates — the sending coach's own name)
  myFirstName?: string
  myLastName?: string
}

export function resolveMergeTags(template: string, data: MergeTagData): string {
  const coachLast = data.coachName?.split(' ').pop() || ''
  const coachFirst = data.coachFirstName || data.coachName?.split(' ')[0] || ''

  const tagMap: Record<string, string> = {
    // ── CANONICAL TAGS (preferred) ────────────────────────────────────────────
    // Recipient college coach
    'Coach Last Name':   coachLast,
    'Coach First Name':  coachFirst,
    'Coach Name':        data.coachName || '',
    // School / program
    'School Name':       data.schoolName || '',
    // Player
    'Player First Name': data.playerFirstName || '',
    'Player Last Name':  data.playerLastName || '',
    'Player Position':   data.position || '',
    'Player Grad Year':  data.gradYear || '',
    'Player High School':data.highSchool || '',
    'Player City':       data.city || '',
    'Player State':      data.state || '',
    'Player GPA':        data.gpa || '',
    'Player Film Link':  data.filmLink || '',
    'Player Phone':      data.phone || '',
    'Player Email':      data.email || '',
    // Sender (coach templates)
    'My First Name':     data.myFirstName || '',
    'My Last Name':      data.myLastName || '',

    // ── BACKWARDS COMPAT ──────────────────────────────────────────────────────
    'coach name':        data.coachName || '',
    'Last Name':         coachLast,   // old ambiguous tag — kept as coach last name for DM context
    'last name':         coachLast,
    'School':            data.schoolName || '',
    'school':            data.schoolName || '',
    'First Name':        data.playerFirstName || '',
    'first name':        data.playerFirstName || '',
    'Position':          data.position || '',
    'position':          data.position || '',
    'Film Link':         data.filmLink || '',
    'film link':         data.filmLink || '',
    'Grad Year':         data.gradYear || '',
    'grad year':         data.gradYear || '',
    'High School':       data.highSchool || '',
    'high school':       data.highSchool || '',
    'City':              data.city || '',
    'city':              data.city || '',
    'State':             data.state || '',
    'state':             data.state || '',
    'GPA':               data.gpa || '',
    'gpa':               data.gpa || '',
    'Phone':             data.phone || '',
    'phone':             data.phone || '',
    'Email':             data.email || '',
    'email':             data.email || '',
  }

  // Handle "Coach ((Last Name))" legacy special case
  let result = template.replace(/Coach\s+\(\(Last[_ ]?Name\)\)/gi, () => {
    return 'Coach ' + coachLast
  })

  // Resolve ((tag)) patterns — try exact match then common normalizations
  result = result.replace(/\(\(([^)]+)\)\)/g, (_match, tag) => {
    const trimmed = tag.trim()
    const variations = [
      trimmed,
      trimmed.replace(/_/g, ' '),
      trimmed.replace(/\s+/g, '_'),
      trimmed.toLowerCase(),
      trimmed.replace(/_/g, ' ').toLowerCase(),
      trimmed.replace(/\s+/g, '_').toLowerCase(),
    ]
    for (const v of variations) {
      if (tagMap[v] !== undefined) return tagMap[v]
    }
    return '' // Unknown tag → empty (display only; send-side blocks on unresolved tags)
  })

  return result
}
