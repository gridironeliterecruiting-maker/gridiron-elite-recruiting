/**
 * Shared merge tag resolution for both email and DM campaigns.
 * Tags use ((tag_name)) format.
 */

export interface MergeTagData {
  coachName?: string
  coachFirstName?: string
  schoolName?: string
  playerFirstName?: string
  playerLastName?: string
  position?: string
  filmLink?: string
  gradYear?: string
  highSchool?: string
  city?: string
  state?: string
  gpa?: string
  phone?: string
  email?: string
}

/**
 * Resolve ((merge tags)) in a message template.
 * Used client-side by DM Queue and server-side by email processor.
 */
export function resolveMergeTags(template: string, data: MergeTagData): string {
  const coachLast = data.coachName?.split(' ').pop() || ''

  const tagMap: Record<string, string> = {
    'Coach Name': data.coachName || 'Coach',
    'coach name': data.coachName || 'Coach',
    'Last Name': coachLast,
    'last name': coachLast,
    'School': data.schoolName || '',
    'school': data.schoolName || '',
    'First Name': data.playerFirstName || '',
    'first name': data.playerFirstName || '',
    'Position': data.position || '',
    'position': data.position || '',
    'Film Link': data.filmLink || '',
    'film link': data.filmLink || '',
    'Grad Year': data.gradYear || '',
    'grad year': data.gradYear || '',
    'High School': data.highSchool || '',
    'high school': data.highSchool || '',
    'City': data.city || '',
    'city': data.city || '',
    'State': data.state || '',
    'state': data.state || '',
    'GPA': data.gpa || '',
    'gpa': data.gpa || '',
    'Phone': data.phone || '',
    'phone': data.phone || '',
    'Email': data.email || '',
    'email': data.email || '',
  }

  // Handle "Coach ((Last Name))" special case
  let result = template.replace(/Coach\s+\(\(Last[_ ]?Name\)\)/gi, () => {
    return 'Coach ' + coachLast
  })

  // Replace all ((tag)) patterns
  result = result.replace(/\(\(([^)]+)\)\)/g, (_match, tag) => {
    const trimmed = tag.trim()
    // Try exact match, then various normalizations
    const variations = [
      trimmed,
      trimmed.replace(/_/g, ' '),
      trimmed.replace(/\s+/g, '_'),
      trimmed.toLowerCase(),
      trimmed.replace(/_/g, ' ').toLowerCase(),
    ]

    for (const v of variations) {
      if (tagMap[v] !== undefined) return tagMap[v]
    }

    return '' // Unknown tag → empty
  })

  return result
}
