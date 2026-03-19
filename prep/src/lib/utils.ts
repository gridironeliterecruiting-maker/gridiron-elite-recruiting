import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Always display GPA with at least one decimal place, max 2 decimal places, no trailing zeros
// e.g. 4 → "4.0", 4.1 → "4.1", 4.19 → "4.19", 4.10 → "4.1", 4.199 → "4.2"
export function formatGPA(gpa: number | string | null | undefined): string {
  if (gpa == null || gpa === '') return ''
  const num = Number(gpa)
  if (isNaN(num)) return String(gpa)
  // Round to 2 decimal places, strip trailing zeros, ensure at least x.y
  const rounded = Math.round(num * 100) / 100
  const str = rounded.toString()
  return str.includes('.') ? str : str + '.0'
}
