import { test, expect } from '@playwright/test'
import { signInAs } from './helpers'
import { config as loadEnv } from 'dotenv'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

/**
 * Regression test for "Save as Draft" in the campaign builder.
 *
 * Bug Paul reported: clicking "Save as Draft" in the leave-confirmation
 * dialog leaves the user on the campaign builder (no navigation). On a
 * second leave attempt, only "Delete" gets them out — and the draft is
 * NOT in the outreach list afterward.
 *
 * Root cause: /api/campaigns/create rejects partial drafts. The route
 * requires templates.length > 0 AND recipients.length > 0 for email
 * campaigns regardless of status. A user mid-build (e.g. has picked
 * coaches but not yet selected a template, or vice versa) can't save.
 * The client's handleSaveDraft silently swallows the 400 — dialog
 * closes, no navigation, no error shown. User thinks it saved.
 *
 * This spec exercises the real contract:
 *   1. status=draft + no templates + no recipients → must succeed
 *      (a draft is allowed to be empty)
 *   2. status=draft + recipients only → must succeed
 *   3. status=draft + templates only → must succeed
 *   4. status=active (or omitted) + no templates → must STILL 400
 *      (launching requires a complete campaign — that gate stays)
 */

loadEnv({ path: path.resolve(__dirname, '..', '.env.local') })
loadEnv({ path: path.resolve(__dirname, '..', '.env.development') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const admin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null

const ATHLETE_1_USER_ID = '00000000-0000-0000-0000-000000000002'

test.describe('campaign create — save as draft', () => {
  test.skip(!admin, 'Supabase env not configured locally')

  // Track campaigns we create so we can clean them up
  const createdIds: string[] = []

  test.afterAll(async () => {
    if (createdIds.length === 0) return
    await admin!.from('campaign_recipients').delete().in('campaign_id', createdIds)
    await admin!.from('campaign_emails').delete().in('campaign_id', createdIds)
    await admin!.from('campaigns').delete().in('id', createdIds)
  })

  test('draft with no templates and no recipients persists', async ({ page, request }) => {
    await signInAs(page, 'athlete1')
    const cookies = await page.context().cookies()
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ')

    const res = await request.post('/api/campaigns/create', {
      headers: { cookie: cookieHeader },
      data: {
        name: `e2e-draft-empty-${Date.now()}`,
        goal: 'get_response',
        status: 'draft',
        templates: [],
        recipients: [],
      },
    })

    expect(
      res.status(),
      'a draft with no templates/recipients must save — that is the whole point of "Save as Draft"',
    ).toBe(200)
    const body = await res.json()
    expect(body.campaignId).toBeTruthy()
    createdIds.push(body.campaignId)

    // It must actually be in the DB with status='draft' so the outreach list shows it.
    const { data: row } = await admin!
      .from('campaigns')
      .select('id, status, user_id')
      .eq('id', body.campaignId)
      .single()
    expect(row?.status).toBe('draft')
    expect(row?.user_id).toBe(ATHLETE_1_USER_ID)
  })

  test('draft with recipients only (no template yet) persists', async ({ page, request }) => {
    await signInAs(page, 'athlete1')
    const cookies = await page.context().cookies()
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ')

    const res = await request.post('/api/campaigns/create', {
      headers: { cookie: cookieHeader },
      data: {
        name: `e2e-draft-recip-${Date.now()}`,
        goal: 'get_response',
        status: 'draft',
        templates: [],
        recipients: [
          { coachId: null, coachName: 'Coach A', email: 'a@example.test', programName: 'School A' },
        ],
      },
    })

    expect(res.status(), 'draft with recipients only must save').toBe(200)
    const body = await res.json()
    createdIds.push(body.campaignId)
  })

  test('draft with templates only (no recipients yet) persists', async ({ page, request }) => {
    await signInAs(page, 'athlete1')
    const cookies = await page.context().cookies()
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ')

    const res = await request.post('/api/campaigns/create', {
      headers: { cookie: cookieHeader },
      data: {
        name: `e2e-draft-tmpl-${Date.now()}`,
        goal: 'get_response',
        status: 'draft',
        templates: [
          { name: 'Email 1', subject: 'Hi', body: 'Body', delayDays: 0 },
        ],
        recipients: [],
      },
    })

    expect(res.status(), 'draft with templates only must save').toBe(200)
    const body = await res.json()
    createdIds.push(body.campaignId)
  })

  test('non-draft (active) campaign still requires complete data', async ({ page, request }) => {
    await signInAs(page, 'athlete1')
    const cookies = await page.context().cookies()
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ')

    const res = await request.post('/api/campaigns/create', {
      headers: { cookie: cookieHeader },
      data: {
        name: `e2e-nondraft-${Date.now()}`,
        goal: 'get_response',
        // status omitted → defaults to 'draft' currently; explicitly try to bypass:
        status: 'active',
        templates: [],
        recipients: [],
      },
    })

    expect(
      res.status(),
      'launching an empty campaign must still 400 — the loose validation is only for drafts',
    ).toBe(400)
  })
})
