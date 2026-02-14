'use client'

import { useGmailTokenCapture } from '@/hooks/use-gmail-token-capture'

export function GmailTokenCaptureWrapper() {
  useGmailTokenCapture()
  return null
}
