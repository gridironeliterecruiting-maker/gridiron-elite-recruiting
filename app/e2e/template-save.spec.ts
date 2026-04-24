import { test, expect } from '@playwright/test'
import { signInAs } from './helpers'

/**
 * Regression test for the Edit Email "Save Changes" bug.
 *
 * The bug: clicking Save Changes in the campaign-builder template editor
 * either never persisted at all (original report) or stopped persisting
 * after the first successful save (the "edit twice" failure Paul kept
 * hitting on staging).
 *
 * This spec exercises the real HTTP contract end-to-end:
 *   1. Authenticated POST /api/templates — creates a user template
 *      (mirrors the first edit of a default template).
 *   2. Authenticated PUT /api/templates/[id] — updates the same template
 *      (mirrors the second edit, which was silently 404/405'ing).
 *   3. Authenticated GET /api/templates — confirms the updated body is
 *      what the server now returns.
 *
 * If either write fails, the test fails and the fix isn't actually shipped.
 */
test.describe('template save — edit-twice loop', () => {
  test('POST then PUT the same user template, both persist', async ({ page, request }) => {
    await signInAs(page, 'athlete1')
    const cookies = await page.context().cookies()
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ')
    const auth = { cookie: cookieHeader }

    const uniqueName = `e2e-template-${Date.now()}`
    const firstBody = 'First save — hi coach ((Coach Last Name))'
    const secondBody = 'Second save — totally different body'

    // 1. Create (simulates first Save Changes on a default)
    const createRes = await request.post('/api/templates', {
      headers: auth,
      data: { name: uniqueName, subject: 'Subject v1', body: firstBody },
    })
    expect(createRes.status(), `create should 201, got ${createRes.status()}`).toBe(201)
    const { template: created } = await createRes.json()
    expect(created.id).toBeTruthy()
    expect(created.body).toBe(firstBody)

    // 2. Update (simulates second Save Changes — this is where staging was failing)
    const updateRes = await request.put(`/api/templates/${created.id}`, {
      headers: auth,
      data: { name: uniqueName, subject: 'Subject v2', body: secondBody },
    })
    expect(
      updateRes.status(),
      `update should 200, got ${updateRes.status()} — if 404 the RLS policy is blocking UPDATE; if 405 the wrong HTTP verb is being used`
    ).toBe(200)
    const { template: updated } = await updateRes.json()
    expect(updated.body).toBe(secondBody)
    expect(updated.subject).toBe('Subject v2')

    // 3. Verify the change is actually in the DB, visible on the next GET
    const listRes = await request.get('/api/templates', { headers: auth })
    expect(listRes.status()).toBe(200)
    const { templates } = await listRes.json()
    const found = templates.find((t: { id: string }) => t.id === created.id)
    expect(found, 'updated template must still exist after PUT').toBeTruthy()
    expect(found.body).toBe(secondBody)
    expect(found.subject).toBe('Subject v2')
  })
})
