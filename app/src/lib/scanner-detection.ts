import { SupabaseClient } from '@supabase/supabase-js'

// Scanner window: how far after send to flag events when scanner is detected
const SCANNER_WINDOW_MS = 3 * 60 * 1000 // 3 minutes

// Cohort cluster threshold: if ALL recipients at a domain have first-events
// within this window of each other, it's a scanner
const COHORT_CLUSTER_MS = 2 * 60 * 1000 // 2 minutes

/**
 * Cohort analysis: detect when ALL recipients sharing an email domain
 * within a campaign have opens/clicks clustered in a tight window.
 *
 * If 5 coaches at @cornell.edu all "open" within 2 minutes of each other,
 * that's a scanner — regardless of how long after send it happened.
 * A single coach opening quickly is fine. But the entire domain lighting up
 * simultaneously is not human behavior.
 *
 * Skips domains with only 1 recipient (no cohort to analyze).
 *
 * When detected:
 * 1. Flags all recipients at that domain with scanner_detected_at
 * 2. Soft-deletes their opens/clicks within the scanner window (sets scanner_flagged_at)
 * 3. Clears opened_at on those recipients
 *
 * Data is NEVER hard-deleted — only flagged for exclusion from stats.
 */
export async function runCohortAnalysis(
  admin: SupabaseClient,
  recipientId: string,
  campaignId: string
): Promise<void> {
  try {
    // Get this recipient's coach_email
    const { data: thisRecipient } = await admin
      .from('campaign_recipients')
      .select('coach_email, sent_at')
      .eq('id', recipientId)
      .single()

    if (!thisRecipient?.coach_email) return

    const domain = thisRecipient.coach_email.split('@')[1]
    if (!domain) return

    // Find all recipients in this campaign with the same email domain
    const { data: cohort } = await admin
      .from('campaign_recipients')
      .select('id, sent_at, scanner_detected_at')
      .eq('campaign_id', campaignId)
      .like('coach_email', `%@${domain}`)

    if (!cohort || cohort.length < 2) return // Need at least 2 to detect a pattern

    // Already flagged? Skip re-processing
    if (cohort.every(r => r.scanner_detected_at)) return

    // For each cohort member, find their earliest unflagged open or click event
    const firstEvents: { recipientId: string; firstAt: Date }[] = []

    for (const r of cohort) {
      const { data: earliest } = await admin
        .from('email_events')
        .select('created_at')
        .eq('recipient_id', r.id)
        .in('event_type', ['opened', 'clicked'])
        .is('scanner_flagged_at', null)
        .order('created_at', { ascending: true })
        .limit(1)
        .single()

      if (earliest) {
        firstEvents.push({ recipientId: r.id, firstAt: new Date(earliest.created_at) })
      }
    }

    // ALL recipients at this domain must have at least one event to trigger detection
    if (firstEvents.length < cohort.length) return

    // Check if all first-events cluster within the threshold
    const times = firstEvents.map(e => e.firstAt.getTime())
    const earliest = Math.min(...times)
    const latest = Math.max(...times)
    const spread = latest - earliest

    if (spread > COHORT_CLUSTER_MS) return // Too spread out — could be real

    // SCANNER DETECTED: entire domain lit up within the cluster window
    const now = new Date().toISOString()
    const recipientIds = cohort.map(r => r.id)

    // Flag all recipients at this domain
    await admin
      .from('campaign_recipients')
      .update({ scanner_detected_at: now })
      .in('id', recipientIds)

    // For each recipient, soft-delete events within the scanner window of their send time
    for (const r of cohort) {
      if (!r.sent_at) continue
      const windowEnd = new Date(new Date(r.sent_at).getTime() + SCANNER_WINDOW_MS).toISOString()

      // Flag events as scanner-generated (soft-delete — never hard-delete)
      await admin
        .from('email_events')
        .update({ scanner_flagged_at: now })
        .eq('recipient_id', r.id)
        .in('event_type', ['opened', 'clicked'])
        .is('scanner_flagged_at', null)
        .lte('created_at', windowEnd)

      // Clear opened_at if it was set during the scanner window
      await admin
        .from('campaign_recipients')
        .update({ opened_at: null })
        .eq('id', r.id)
        .lte('opened_at', windowEnd)
    }
  } catch (error) {
    // Non-fatal — don't break tracking if cohort analysis fails
    console.error('[cohort-analysis] error:', error)
  }
}

/**
 * Honeypot cleanup: flag a specific recipient and soft-delete their scanner events.
 * Called when the honeypot link is triggered.
 *
 * Data is NEVER hard-deleted — only flagged for exclusion from stats.
 */
export async function handleHoneypotDetection(
  admin: SupabaseClient,
  recipientId: string,
  campaignId: string
): Promise<void> {
  try {
    const now = new Date()
    const nowISO = now.toISOString()

    // Flag this recipient
    await admin
      .from('campaign_recipients')
      .update({ scanner_detected_at: nowISO })
      .eq('id', recipientId)

    // Get sent_at for scanner window calculation
    const { data: recipient } = await admin
      .from('campaign_recipients')
      .select('sent_at')
      .eq('id', recipientId)
      .single()

    if (recipient?.sent_at) {
      // The scanner window extends to whichever is later:
      //   a) sent_at + 3 minutes (the standard scanner burst window)
      //   b) NOW (the moment the honeypot fired)
      // This matters because some scanners hit the real link BEFORE the
      // honeypot (e.g. at 4 min) but the honeypot fires at 7 min.
      // Using just sent_at + 3min would miss the 4-minute event.
      const fixedWindowEnd = new Date(recipient.sent_at).getTime() + SCANNER_WINDOW_MS
      const windowEnd = new Date(Math.max(fixedWindowEnd, now.getTime())).toISOString()

      // Flag events as scanner-generated (soft-delete)
      await admin
        .from('email_events')
        .update({ scanner_flagged_at: nowISO })
        .eq('recipient_id', recipientId)
        .in('event_type', ['opened', 'clicked'])
        .is('scanner_flagged_at', null)
        .lte('created_at', windowEnd)

      // Clear opened_at if it was set during the scanner window
      await admin
        .from('campaign_recipients')
        .update({ opened_at: null })
        .eq('id', recipientId)
        .lte('opened_at', windowEnd)
    }

    // Also run cohort analysis — this honeypot hit may reveal a domain-wide scanner
    await runCohortAnalysis(admin, recipientId, campaignId)
  } catch (error) {
    console.error('[honeypot-detection] error:', error)
  }
}
