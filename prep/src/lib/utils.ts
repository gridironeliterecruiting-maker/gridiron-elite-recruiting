import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Always display GPA with at least one decimal place (4 → 4.0, 4.19 → 4.19)
export function formatGPA(gpa: number | string | null | undefined): string {
  if (gpa == null || gpa === '') return ''
  const str = Number(gpa).toString()
  if (isNaN(Number(gpa))) return String(gpa)
  return str.includes('.') ? str : str + '.0'
}
