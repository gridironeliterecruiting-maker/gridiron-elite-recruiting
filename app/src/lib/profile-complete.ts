/**
 * Profile completeness check — used to gate campaign creation.
 *
 * These are the fields that merge tags depend on. If any are empty,
 * campaign emails will have awkward blanks where data should be.
 */

export const REQUIRED_PROFILE_FIELDS = [
  { key: 'first_name', label: 'First Name' },
  { key: 'last_name', label: 'Last Name' },
  { key: 'position', label: 'Position' },
  { key: 'grad_year', label: 'Grad Year' },
  { key: 'high_school', label: 'High School' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
] as const

export function getMissingProfileFields(profile: Record<string, unknown>): string[] {
  return REQUIRED_PROFILE_FIELDS
    .filter(f => !profile[f.key])
    .map(f => f.label)
}

export function isProfileComplete(profile: Record<string, unknown>): boolean {
  return getMissingProfileFields(profile).length === 0
}
